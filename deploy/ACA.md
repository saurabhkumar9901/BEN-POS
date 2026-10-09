# Deploy the whole desk to Azure Container Apps (single container)

> One warm container, real filesystem semantics, no function timeouts.
> Data lives on an Azure Files share; the image itself is data-free.

## 0. Prereqs (one time)

- Azure account + subscription, [Azure CLI](https://aka.ms/installazurecli) logged in (`az login`)
- Docker Desktop (to build + push the image), GitHub repo `$REPO = saurabhkumar9901/BEN-POS`

```powershell
$RG = "benpos-rg"; $LOC = "centralindia"; $ENV = "benpos-env"; $APP = "benpos-desk"
$STORE = "benposstore$((Get-Random -Max 99999).ToString('00000'))"  # must be globally unique, lowercase
$SHARE = "benpos-data"; $IMAGE = "ghcr.io/saurabhkumar9901/ben-pos:latest"
az group create -n $RG -l $LOC
```

## 1. File share (survives restarts + revisions)

```powershell
az storage account create -n $STORE -g $RG -l $LOC --sku Standard_LRS
az storage share create --account-name $STORE --name $SHARE
$KEY = (az storage account keys list -n $STORE -g $RG --query "[0].value" -o tsv)
```

## 2. Build + push (from repo root)

```powershell
docker build -t $IMAGE .
echo <github-PAT-classic:read,write:packages> | docker login ghcr.io -u saurabhkumar9901 --password-stdin
docker push $IMAGE
```

## 3. Container Apps environment (one time)

```powershell
az extension add -n containerapp
az monitor log-analytics workspace create -n benpos-logs -g $RG -l $LOC
$WSID = (az monitor log-analytics workspace show -n benpos-logs -g $RG --query customerId -o tsv)
$WSKEY = (az monitor log-analytics workspace get-shared-keys -n benpos-logs -g $RG --query primarySharedKey -o tsv)
az containerapp env create -n $ENV -g $RG -l $LOC `
  --logs-destination log-analytics `
  --logs-analytics-workspace $WSID --logs-analytics-primary-key $WSKEY
```

## 4. The app (single replica: DuckDB writer lock)

```powershell
az containerapp create -n $APP -g $RG --environment $ENV `
  --image $IMAGE --target-port 3000 --ingress external `
  --min-replicas 0 --max-replicas 1 --cpu 2 --memory 4Gi `
  --azure-file-volume account-name=$STORE account-key=$KEY share-name=$SHARE access-mode=ReadWrite mount-path=/mnt/share
az containerapp show -n $APP -g $RG --query properties.configuration.ingress.fqdn -o tsv
```

Open the FQDN → Overview should load from the empty store; feed it via
`/ingestion` (uploads land on the share, pipeline runs in-container).

## 5. Updates

```powershell
docker build -t $IMAGE .; docker push $IMAGE
az containerapp update -n $APP -g $RG --image $IMAGE   # new revision, share intact
```

## Notes

- MotherDuck sync stays optional offsite backup (`build-db --motherduck`
  inside the container works unchanged).
- Easy Auth (Entra login gate) later: Portal → Container App →
  Authentication → Add identity provider. Recommended before exposing
  shareholder names publicly.
- If cold starts annoy: `--min-replicas 1` (always warm, always billed).
