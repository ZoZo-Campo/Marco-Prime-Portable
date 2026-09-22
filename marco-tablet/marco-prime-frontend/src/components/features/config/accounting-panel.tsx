import {
  Archive,
  Calculator,
  Check,
  CheckCircle2,
  Download,
  FileArchive,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-preact";
import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { apiHeaders, apiUrl } from "../../../config/api";
import {
  accountingExportSchema,
  accountingSchema,
  type Accounting,
  type AccountingExport,
  type AccountingRow,
} from "../../../schemas/accounting.schema";
import {
  productCostListSchema,
  statisticsResponseSchema,
  type ProductCost,
} from "../../../schemas/statistics.schema";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";

interface AccountingPanelProps {
  adminCardNumber: number;
}

type EditableRow = Pick<
  AccountingRow,
  | "id"
  | "productId"
  | "label"
  | "liters"
  | "purchasePricePerLiter"
  | "revenue"
>;
type AccountingStatus = "draft" | "closed";
type DialogName = "new-event" | "close-event" | null;

interface AccountingDraft {
  status: AccountingStatus;
  eventName: string;
  eventDate: string;
  rows: EditableRow[];
}

interface WritableFile {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}
interface SaveFileHandle {
  createWritable(): Promise<WritableFile>;
}
interface DirectoryHandle {
  getFileHandle(name: string, options: { create: boolean }): Promise<SaveFileHandle>;
}
interface FilePickerWindow extends Window {
  showDirectoryPicker?: (options?: { mode?: "readwrite" }) => Promise<DirectoryHandle>;
}

export function AccountingPanel({ adminCardNumber }: AccountingPanelProps) {
  const [accounting, setAccounting] = useState<Accounting | null>(null);
  const [products, setProducts] = useState<ProductCost[]>([]);
  const [purchasePriceDefaults, setPurchasePriceDefaults] = useState<Map<number, string>>(new Map());
  const [status, setStatus] = useState<AccountingStatus>("draft");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [rechargeExportFrom, setRechargeExportFrom] = useState(todayLocal());
  const [rechargeExportTo, setRechargeExportTo] = useState(todayLocal());
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [lastPrefillAt, setLastPrefillAt] = useState<string | null>(null);
  const [lastExportSignature, setLastExportSignature] = useState<string | null>(null);
  const loaded = useRef(false);
  const lastSavedSignature = useRef("");

  const draft = useMemo<AccountingDraft>(
    () => ({ status, eventName, eventDate, rows }),
    [status, eventName, eventDate, rows],
  );
  const draftSignature = useMemo(() => signature(draft), [draft]);
  const hasUnsavedChanges = loaded.current && draftSignature !== lastSavedSignature.current;
  const isClosed = status === "closed";
  const availableProducts = useMemo(
    () => products.filter((product) => product.available).sort(compareProducts),
    [products],
  );
  const archivedProducts = useMemo(
    () => products.filter((product) => !product.available).sort(compareProducts),
    [products],
  );

  const load = async () => {
    loaded.current = false;
    setLoading(true);
    setMessage(null);
    try {
      const [accountingResponse, productsResponse] = await Promise.all([
        fetch(apiUrl("accounting"), {
          method: "POST",
          headers: apiHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ adminCardNumber }),
        }),
        fetch(apiUrl("statistics/costs"), {
          method: "POST",
          headers: apiHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ adminCardNumber }),
        }),
      ]);
      if (!accountingResponse.ok || !productsResponse.ok) throw new Error("HTTP error");

      const value = accountingSchema.parse(await accountingResponse.json());
      const catalogue = productCostListSchema.parse(await productsResponse.json());
      const editableRows = toEditableRows(value, catalogue);
      const nextDraft = {
        status: value.status,
        eventName: value.eventName,
        eventDate: value.eventDate,
        rows: editableRows,
      };
      setAccounting(value);
      setProducts(catalogue);
      setPurchasePriceDefaults(defaultsMap(value));
      setStatus(value.status);
      setEventName(value.eventName);
      setEventDate(value.eventDate);
      setRows(editableRows);
      lastSavedSignature.current = signature(nextDraft);
      loaded.current = true;
    } catch {
      setMessage("Impossible de charger la comptabilité et le catalogue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [adminCardNumber]);

  const persist = async (nextDraft: AccountingDraft, quiet = false) => {
    if (!isValidDraft(nextDraft)) {
      if (!quiet) {
        setMessage("Choisissez un produit différent par ligne et vérifiez tous les nombres.");
      }
      return null;
    }
    setSaving(true);
    try {
      const requestSignature = signature(nextDraft);
      const response = await fetch(apiUrl("accounting"), {
        method: "PUT",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          adminCardNumber,
          status: nextDraft.status,
          eventName: nextDraft.eventName.trim(),
          eventDate: nextDraft.eventDate,
          rows: normalizeRows(nextDraft.rows),
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const value = accountingSchema.parse(await response.json());
      setAccounting(value);
      setPurchasePriceDefaults(defaultsMap(value));
      lastSavedSignature.current = requestSignature;
      if (!quiet) setMessage("Comptabilité enregistrée.");
      return value;
    } catch {
      setMessage("Impossible d’enregistrer la comptabilité.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (loading || saving || isClosed || !loaded.current || !hasUnsavedChanges || !isValidDraft(draft)) return;
    const timer = window.setTimeout(() => void persist(draft, true), 800);
    return () => window.clearTimeout(timer);
  }, [draftSignature, loading, saving, isClosed]);

  const save = async () => {
    const value = await persist(draft);
    if (!value) return;
    const editableRows = toEditableRows(value, products);
    setRows(editableRows);
    setEventName(value.eventName);
    setEventDate(value.eventDate);
    setStatus(value.status);
    lastSavedSignature.current = signature({
      status: value.status,
      eventName: value.eventName,
      eventDate: value.eventDate,
      rows: editableRows,
    });
  };

  const updateRow = (id: string, field: keyof EditableRow, value: string | number | null) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
    setMessage(null);
  };

  const chooseProduct = (rowId: string, value: string) => {
    const product = products.find((item) => item.id === Number(value));
    setRows((current) => current.map((row) =>
      row.id === rowId
        ? {
            ...row,
            productId: product?.id ?? null,
            label: product?.name ?? "",
            purchasePricePerLiter: product ? (purchasePriceDefaults.get(product.id) ?? "0") : "0",
          }
        : row,
    ));
    setMessage(null);
  };

  const addProduct = () => {
    const selectedIds = new Set(rows.flatMap((row) => (row.productId === null ? [] : [row.productId])));
    const normalizedQuery = normalizeSearch(productSearch);
    const product = [...availableProducts, ...archivedProducts].find(
      (item) =>
        !selectedIds.has(item.id) &&
        (!normalizedQuery || normalizeSearch(item.name).includes(normalizedQuery)),
    );
    if (!product) {
      setMessage(
        normalizedQuery
          ? "Aucun autre produit ne correspond à cette recherche."
          : "Tous les produits du catalogue sont déjà présents.",
      );
      return;
    }
    setRows((current) => [...current, newRow(product, purchasePriceDefaults)]);
    setMessage(null);
  };

  const prefillFromSales = async () => {
    if (!eventDate) {
      setMessage("Choisissez d’abord la date de la soirée.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(apiUrl("statistics"), {
        method: "POST",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ adminCardNumber, ...eventRange(eventDate) }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const statistics = statisticsResponseSchema.parse(await response.json());
      const revenues = new Map<string, { revenue: number; productId: number; name: string }>();
      for (const product of statistics.products) {
        const key = productFamily(product.name);
        const current = revenues.get(key);
        revenues.set(key, {
          revenue: (current?.revenue ?? 0) + Number(product.revenue),
          productId: current?.productId ?? product.productId,
          name: current?.name ?? product.name,
        });
      }
      setRows((currentRows) => {
        const remaining = new Map(revenues);
        const nextRows = currentRows.map((row) => {
          const key = productFamily(row.label);
          const sale = remaining.get(key);
          if (!sale) return row;
          remaining.delete(key);
          return { ...row, revenue: decimal(sale.revenue, 2) };
        });
        for (const sale of remaining.values()) {
          const product = products.find((entry) => entry.id === sale.productId)
            ?? products.find((entry) => productFamily(entry.name) === productFamily(sale.name));
          if (product) nextRows.push({ ...newRow(product, purchasePriceDefaults), revenue: decimal(sale.revenue, 2) });
        }
        return nextRows;
      });
      setLastPrefillAt(new Date().toISOString());
      setMessage(
        statistics.summary.salesLines === 0
          ? "Aucune vente trouvée entre 17 h et minuit. Les recettes restent modifiables."
          : `${statistics.summary.salesLines} vente${statistics.summary.salesLines > 1 ? "s" : ""} intégrée${statistics.summary.salesLines > 1 ? "s" : ""}. Vérifiez puis ajustez les recettes réelles si nécessaire.`,
      );
    } catch {
      setMessage("Impossible de récupérer les ventes de cette soirée.");
    } finally {
      setSaving(false);
    }
  };

  const startNewEvent = async (keepProducts: boolean) => {
    const nextRows = keepProducts
      ? rows.map((row) => ({
          ...row,
          id: crypto.randomUUID(),
          liters: "0",
          purchasePricePerLiter: row.productId === null
            ? row.purchasePricePerLiter
            : (purchasePriceDefaults.get(row.productId) ?? row.purchasePricePerLiter),
          revenue: "0",
        }))
      : [];
    const nextDraft: AccountingDraft = {
      status: "draft",
      eventName: "Soirée Marco",
      eventDate: todayLocal(),
      rows: nextRows,
    };
    setDialog(null);
    setStatus(nextDraft.status);
    setEventName(nextDraft.eventName);
    setEventDate(nextDraft.eventDate);
    setRows(nextDraft.rows);
    setLastPrefillAt(null);
    setLastExportSignature(null);
    const value = await persist(nextDraft, true);
    if (value) {
      lastSavedSignature.current = signature(nextDraft);
      setMessage(keepProducts
        ? "Nouvelle soirée créée. Les produits et prix d’achat ont été conservés."
        : "Nouvelle soirée vide créée. Les prix d’achat mémorisés restent disponibles.");
    }
  };

  const reopenEvent = async () => {
    const nextDraft = { ...draft, status: "draft" as const };
    const value = await persist(nextDraft, true);
    if (!value) return;
    setStatus("draft");
    lastSavedSignature.current = signature(nextDraft);
    setMessage("Soirée rouverte. Les saisies peuvent de nouveau être modifiées.");
  };

  const exportFullEvent = async () => {
    const saved = await persist(draft, true);
    if (!saved) return false;
    try {
      const response = await fetch(apiUrl("accounting/export"), {
        method: "POST",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ adminCardNumber, ...eventRange(eventDate) }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const exported = accountingExportSchema.parse(await response.json());
      const files = createExportFiles(exported);
      const directoryPicker = (window as FilePickerWindow).showDirectoryPicker;
      if (directoryPicker) {
        try {
          const directory = await directoryPicker({ mode: "readwrite" });
          for (const file of files) {
            const handle = await directory.getFileHandle(file.name, { create: true });
            const writable = await handle.createWritable();
            await writable.write(file.blob);
            await writable.close();
          }
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") return false;
          throw error;
        }
      } else {
        for (const file of files) downloadBlob(file.name, file.blob);
      }
      setLastExportSignature(draftSignature);
      setMessage(directoryPicker
        ? "Export complet enregistré : 4 CSV et une sauvegarde JSON."
        : "Export téléchargé. Le dossier dépend du réglage de Chromium.");
      return true;
    } catch {
      setMessage("Impossible de créer l’export complet de la soirée.");
      return false;
    }
  };

  const exportRecharges = async () => {
    if (!rechargeExportFrom || !rechargeExportTo || rechargeExportFrom > rechargeExportTo) {
      setMessage("Choisissez une période valide pour les rechargements.");
      return;
    }
    try {
      const from = new Date(`${rechargeExportFrom}T00:00:00`).toISOString();
      const toDate = new Date(`${rechargeExportTo}T00:00:00`);
      toDate.setDate(toDate.getDate() + 1);
      const response = await fetch(apiUrl("accounting/export"), {
        method: "POST",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ adminCardNumber, from, to: toDate.toISOString() }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const exported = accountingExportSchema.parse(await response.json());
      const csv = tableCsv(
        ["Transaction", "Date", "Membre", "Montant", "Paiement reçu"],
        exported.recharges.map((recharge) => [recharge.orderId, formatCsvDate(recharge.date), memberName(recharge), csvNumber(Number(recharge.amount), 2), recharge.paymentMethod === "card" ? "Carte bancaire" : recharge.paymentMethod === "cash" ? "Espèces" : "Non renseigné"]),
      );
      downloadBlob(`rechargements-${rechargeExportFrom}-${rechargeExportTo}.csv`, csvFile("rechargements.csv", csv).blob);
      setMessage(`${exported.recharges.length} rechargement(s) exporté(s).`);
    } catch (error) {
      setMessage(`Export des rechargements impossible : ${error instanceof Error ? error.message : "erreur inconnue"}`);
    }
  };

  const closeEvent = async () => {
    if (!canClose(rows) || lastExportSignature !== draftSignature) return;
    const nextDraft = { ...draft, status: "closed" as const };
    const value = await persist(nextDraft, true);
    if (!value) return;
    setStatus("closed");
    lastSavedSignature.current = signature(nextDraft);
    setDialog(null);
    setMessage("Soirée clôturée. Les données sont verrouillées et exportées.");
  };

  const totals = calculateTotals(rows);
  const pricesReady = rows.length > 0 && rows.every(hasPositivePrice);
  const litersReady = rows.length > 0 && rows.every(hasPositiveLiters);
  const exportReady = lastExportSignature === draftSignature;

  if (loading) {
    return <div class="flex flex-1 items-center justify-center"><Loader2 class="size-12 animate-spin text-primary" /></div>;
  }

  return (
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div class="min-h-0 flex-1 overflow-y-auto p-5 pb-8">
        <div class="mx-auto flex max-w-7xl flex-col gap-5">
        <header class="flex flex-wrap items-end gap-4">
          <div class="mr-auto">
            <h1 class="flex items-center gap-3 text-2xl font-bold"><Calculator /> Compta réelle</h1>
            <p class="mt-1 text-muted-foreground">
              Saisissez les litres réellement écoulés. Les recettes Marco peuvent être préremplies puis corrigées manuellement.
            </p>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span class={`rounded-full px-3 py-1 font-medium ${isClosed ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-300"}`}>
                {isClosed ? "Soirée clôturée" : "Brouillon en cours"}
              </span>
              <SaveState saving={saving} hasUnsavedChanges={hasUnsavedChanges} updatedAt={accounting?.updatedAt ?? null} />
            </div>
          </div>
          <label class="flex flex-col gap-1 text-sm">
            Nom de l’événement
            <input
              class="border bg-input px-3 py-2 text-base disabled:opacity-60"
              value={eventName}
              disabled={isClosed}
              onInput={(event) => { setEventName(event.currentTarget.value); setMessage(null); }}
            />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            Date
            <input
              type="date"
              class="border bg-input px-3 py-2 text-base disabled:opacity-60"
              value={eventDate}
              disabled={isClosed}
              onInput={(event) => { setEventDate(event.currentTarget.value); setLastPrefillAt(null); setMessage(null); }}
            />
          </label>
        </header>

        {!isClosed && (
          <Card class="flex flex-wrap items-center gap-3 p-4">
            <Button variant="outline" disabled={saving} onClick={() => void prefillFromSales()}>
              <Sparkles /> Préremplir depuis les ventes
            </Button>
            <p class="text-sm text-muted-foreground">
              Période utilisée : 17 h–minuit le jour choisi. Les valeurs restent modifiables pour refléter les pertes et écarts réels.
              {lastPrefillAt && ` Dernier préremplissage : ${new Date(lastPrefillAt).toLocaleTimeString("fr-FR")}.`}
            </p>
          </Card>
        )}

        <Card class="overflow-hidden p-0">
          <div class="flex flex-wrap items-center gap-3 border-b p-3">
            <label class="flex min-h-12 min-w-72 flex-1 items-center gap-2 border bg-background px-3">
              <Search class="size-5 text-muted-foreground" />
              <input
                class="min-w-0 flex-1 bg-transparent text-base outline-none"
                placeholder="Rechercher un produit…"
                value={productSearch}
                onInput={(event) => setProductSearch(event.currentTarget.value)}
              />
              {productSearch && (
                <button aria-label="Effacer la recherche" class="p-2 text-muted-foreground" onClick={() => setProductSearch("")}>
                  <X class="size-5" />
                </button>
              )}
            </label>
            <span class="text-sm text-muted-foreground">
              Produits vendus actuellement en premier · anciens produits conservés pour la compta
            </span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[960px] border-collapse text-left">
              <thead class="bg-muted/50">
                <tr>
                  <th class="p-3">Produit Fouaille</th><th class="p-3">Litres réels</th>
                  <th class="p-3">Prix achat / L</th><th class="p-3">Coût total</th>
                  <th class="p-3">Recettes réelles</th><th class="p-3">Résultat</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const values = calculateRow(row);
                  const selectedElsewhere = new Set(rows.flatMap((item) =>
                    item.id !== row.id && item.productId !== null ? [item.productId] : [],
                  ));
                  return (
                    <tr key={row.id} class="border-t">
                      <td class="p-2">
                        <select
                          class="w-full min-w-52 border bg-input px-3 py-2 disabled:opacity-60"
                          value={row.productId ?? ""}
                          disabled={isClosed}
                          onChange={(event) => chooseProduct(row.id, event.currentTarget.value)}
                        >
                          {row.productId === null && <option value="">Choisir un produit…</option>}
                          <ProductOptions
                            currentProductId={row.productId}
                            query={productSearch}
                            available={availableProducts}
                            archived={archivedProducts}
                            selectedElsewhere={selectedElsewhere}
                          />
                        </select>
                      </td>
                      <td class="p-2"><NumberInput value={row.liters} disabled={isClosed} onInput={(value) => updateRow(row.id, "liters", value)} /></td>
                      <td class="p-2"><NumberInput value={row.purchasePricePerLiter} disabled={isClosed} onInput={(value) => updateRow(row.id, "purchasePricePerLiter", value)} /></td>
                      <td class="p-3 font-medium">{formatMoney(values.cost)}</td>
                      <td class="p-2"><NumberInput value={row.revenue} disabled={isClosed} onInput={(value) => updateRow(row.id, "revenue", value)} /></td>
                      <td class={`p-3 font-bold ${values.result < 0 ? "text-destructive" : "text-green-400"}`}>
                        {formatMoney(values.result)}
                      </td>
                      <td class="p-2">
                        <Button
                          aria-label={`Supprimer ${row.label}`}
                          size="icon"
                          variant="ghost"
                          disabled={isClosed}
                          onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                        ><Trash2 /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot class="border-t-2 bg-muted/40 font-bold">
                <tr>
                  <td class="p-3">TOTAL</td><td class="p-3">{formatLiters(totals.liters)}</td><td />
                  <td class="p-3">{formatMoney(totals.cost)}</td><td class="p-3">{formatMoney(totals.revenue)}</td>
                  <td class="p-3">{formatMoney(totals.result)}</td><td />
                </tr>
              </tfoot>
            </table>
          </div>
          {rows.length === 0 && <p class="p-8 text-center text-muted-foreground">Ajoutez un produit ou préremplissez les ventes pour commencer.</p>}
        </Card>

          <Card class="flex flex-wrap items-end gap-3 p-4">
            <label class="flex flex-col gap-1 text-sm">Rechargements du
              <input type="date" class="border bg-input px-3 py-2 text-base" value={rechargeExportFrom} onInput={(event) => setRechargeExportFrom(event.currentTarget.value)} />
            </label>
            <label class="flex flex-col gap-1 text-sm">Au (inclus)
              <input type="date" class="border bg-input px-3 py-2 text-base" value={rechargeExportTo} onInput={(event) => setRechargeExportTo(event.currentTarget.value)} />
            </label>
            <Button variant="outline" onClick={() => void exportRecharges()}><Download /> Exporter rechargements CSV</Button>
            <p class="w-full text-xs text-muted-foreground">Les modes de paiement antérieurs ou enregistrés sur une autre Marco apparaissent « Non renseigné ».</p>
          </Card>
          {message && <p class="text-center text-lg">{message}</p>}
        </div>
      </div>

      <div class="z-30 flex shrink-0 flex-wrap items-center gap-3 border-t bg-background px-5 py-3 shadow-[0_-8px_20px_rgba(0,0,0,0.35)]">
          {!isClosed && <Button variant="outline" onClick={addProduct}><Plus /> Ajouter un produit</Button>}
          <Button variant="outline" disabled={saving} onClick={() => void exportFullEvent()}><Download /> Export complet…</Button>
          <Button variant="outline" onClick={() => setDialog("new-event")}><RefreshCw /> Nouvelle soirée</Button>
          {isClosed ? (
            <Button class="ml-auto" disabled={saving} onClick={() => void reopenEvent()}>Rouvrir la soirée</Button>
          ) : (
            <>
              <Button variant="outline" disabled={saving} onClick={() => setDialog("close-event")}><Archive /> Clôturer la soirée</Button>
              <Button class="ml-auto" disabled={saving || !hasUnsavedChanges} onClick={() => void save()}>
                {saving ? <Loader2 class="animate-spin" /> : <Save />} Enregistrer maintenant
              </Button>
            </>
          )}
      </div>

      {dialog === "new-event" && (
        <Modal title="Créer une nouvelle soirée" onClose={() => setDialog(null)}>
          <p class="text-muted-foreground">
            La soirée actuelle est remplacée dans le brouillon local. Exportez-la d’abord si vous devez conserver son bilan.
            Les prix d’achat au litre mémorisés ne sont jamais supprimés.
          </p>
          <div class="mt-5 grid gap-3 sm:grid-cols-2">
            <Button variant="outline" disabled={saving} onClick={() => void startNewEvent(true)}>Garder les produits habituels</Button>
            <Button disabled={saving} onClick={() => void startNewEvent(false)}>Commencer avec une liste vide</Button>
          </div>
        </Modal>
      )}

      {dialog === "close-event" && (
        <Modal title="Clôture guidée de la soirée" onClose={() => setDialog(null)}>
          <div class="space-y-3">
            <ChecklistLine ready={pricesReady} label="Prix d’achat vérifiés" detail="Chaque produit doit avoir un prix d’achat par litre supérieur à zéro." />
            <ChecklistLine ready={litersReady} label="Litres réels saisis" detail="Chaque ligne conservée doit contenir une quantité réellement mesurée." />
            <ChecklistLine ready={lastPrefillAt !== null} optional label="Ventes Marco vérifiées" detail="Préremplissez les recettes ou vérifiez-les manuellement." />
            <ChecklistLine ready={exportReady} label="Export et sauvegarde créés" detail="Les 4 CSV et la sauvegarde JSON doivent correspondre à la dernière saisie." />
          </div>
          <div class="mt-5 flex flex-wrap gap-3">
            <Button variant="outline" disabled={saving} onClick={() => void exportFullEvent()}><FileArchive /> Exporter et sauvegarder…</Button>
            <Button class="ml-auto" disabled={saving || !canClose(rows) || !exportReady} onClick={() => void closeEvent()}>
              <Check /> Marquer la soirée terminée
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ProductOptions({ currentProductId, query, available, archived, selectedElsewhere }: {
  currentProductId: number | null;
  query: string;
  available: ProductCost[];
  archived: ProductCost[];
  selectedElsewhere: Set<number>;
}) {
  const matches = (product: ProductCost) => product.id === currentProductId || normalizeSearch(product.name).includes(normalizeSearch(query));
  const visibleAvailable = available.filter(matches);
  const visibleArchived = archived.filter(matches);
  return (
    <>
      {visibleAvailable.length > 0 && (
        <optgroup label="En vente actuellement">
          {visibleAvailable.map((product) => <option key={product.id} value={product.id} disabled={selectedElsewhere.has(product.id)}>{product.name}</option>)}
        </optgroup>
      )}
      {visibleArchived.length > 0 && (
        <optgroup label="Anciens produits / hors vente">
          {visibleArchived.map((product) => <option key={product.id} value={product.id} disabled={selectedElsewhere.has(product.id)}>{product.name} · hors vente actuellement</option>)}
        </optgroup>
      )}
      {visibleAvailable.length === 0 && visibleArchived.length === 0 && <option disabled>Aucun produit correspondant</option>}
    </>
  );
}

function SaveState({ saving, hasUnsavedChanges, updatedAt }: { saving: boolean; hasUnsavedChanges: boolean; updatedAt: string | null }) {
  if (saving) return <span class="flex items-center gap-1 text-muted-foreground"><Loader2 class="size-4 animate-spin" /> Enregistrement…</span>;
  if (hasUnsavedChanges) return <span class="text-amber-300">Modifications en attente…</span>;
  return (
    <span class="flex items-center gap-1 text-green-400">
      <CheckCircle2 class="size-4" /> Enregistré{updatedAt ? ` à ${new Date(updatedAt).toLocaleTimeString("fr-FR")}` : ""}
    </span>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ComponentChildren }) {
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <Card class="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto p-6 pb-8 shadow-2xl">
        <div class="mb-4 flex items-start justify-between gap-3">
          <h2 class="text-2xl font-bold">{title}</h2>
          <Button size="icon" variant="ghost" aria-label="Fermer" onClick={onClose}><X /></Button>
        </div>
        {children}
      </Card>
    </div>
  );
}

function ChecklistLine({ ready, optional = false, label, detail }: { ready: boolean; optional?: boolean; label: string; detail: string }) {
  return (
    <div class="flex gap-3 rounded-lg border p-3">
      <span class={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${ready ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
        {ready ? <Check class="size-4" /> : "·"}
      </span>
      <div>
        <p class="font-semibold">{label} {optional && <span class="font-normal text-muted-foreground">(conseillé)</span>}</p>
        <p class="text-sm text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function NumberInput({ value, disabled, onInput }: { value: string; disabled: boolean; onInput: (value: string) => void }) {
  return <input inputMode="decimal" class="w-32 border bg-input px-3 py-2 disabled:opacity-60" value={value} disabled={disabled} onInput={(event) => onInput(event.currentTarget.value)} />;
}

function newRow(product: ProductCost, defaults: Map<number, string>): EditableRow {
  return {
    id: crypto.randomUUID(), productId: product.id, label: product.name, liters: "0",
    purchasePricePerLiter: defaults.get(product.id) ?? "0", revenue: "0",
  };
}

function toEditableRows(value: Accounting, catalogue: ProductCost[]) {
  return value.rows.map(({ id, productId, label, liters, purchasePricePerLiter, revenue }) => ({
    id,
    productId: productId ?? catalogue.find((product) => normalizeSearch(product.name) === normalizeSearch(label))?.id ?? null,
    label, liters, purchasePricePerLiter, revenue,
  }));
}

function defaultsMap(accounting: Accounting) {
  return new Map(accounting.productDefaults.map((entry) => [entry.productId, entry.purchasePricePerLiter]));
}

function signature(draft: AccountingDraft) {
  return JSON.stringify({
    status: draft.status, eventName: draft.eventName, eventDate: draft.eventDate,
    rows: draft.rows.map(({ id, productId, label, liters, purchasePricePerLiter, revenue }) => ({ id, productId, label, liters, purchasePricePerLiter, revenue })),
  });
}

function normalizeRows(rows: EditableRow[]) {
  return rows.map((row) => ({
    ...row,
    productId: row.productId as number,
    label: row.label.trim(),
    liters: normalizeNumber(row.liters) as string,
    purchasePricePerLiter: normalizeNumber(row.purchasePricePerLiter) as string,
    revenue: normalizeNumber(row.revenue) as string,
  }));
}

function isValidDraft(draft: AccountingDraft) {
  const productIds = draft.rows.flatMap((row) => row.productId === null ? [] : [row.productId]);
  return draft.eventName.trim() !== ""
    && /^\d{4}-\d{2}-\d{2}$/.test(draft.eventDate)
    && draft.rows.every((row) => row.productId !== null && row.label.trim() !== ""
      && normalizeNumber(row.liters) !== null
      && normalizeNumber(row.purchasePricePerLiter) !== null
      && normalizeNumber(row.revenue) !== null)
    && new Set(productIds).size === draft.rows.length;
}

function normalizeNumber(value: string) {
  const normalized = value.trim().replace(",", ".");
  return /^\d+(?:\.\d+)?$/.test(normalized) && Number.isFinite(Number(normalized)) ? normalized : null;
}

function calculateRow(row: EditableRow) {
  const liters = Number(normalizeNumber(row.liters) ?? 0);
  const cost = liters * Number(normalizeNumber(row.purchasePricePerLiter) ?? 0);
  const revenue = Number(normalizeNumber(row.revenue) ?? 0);
  return { liters, cost, revenue, result: revenue - cost };
}

function calculateTotals(rows: EditableRow[]) {
  return rows.reduce((sum, row) => {
    const value = calculateRow(row);
    return { liters: sum.liters + value.liters, cost: sum.cost + value.cost, revenue: sum.revenue + value.revenue, result: sum.result + value.result };
  }, { liters: 0, cost: 0, revenue: 0, result: 0 });
}

function hasPositivePrice(row: EditableRow) {
  return Number(normalizeNumber(row.purchasePricePerLiter) ?? 0) > 0;
}
function hasPositiveLiters(row: EditableRow) {
  return Number(normalizeNumber(row.liters) ?? 0) > 0;
}
function canClose(rows: EditableRow[]) {
  return rows.length > 0 && rows.every(hasPositivePrice) && rows.every(hasPositiveLiters);
}

function eventRange(eventDate: string) {
  const from = new Date(`${eventDate}T17:00:00`);
  const to = new Date(`${eventDate}T00:00:00`);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

function todayLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function productFamily(value: string) {
  return normalizeSearch(value).replace(/\b(?:25|33|50)\s*c?l\b/g, "").replace(/\b(?:demi|pinte)\b/g, "").replace(/\s+/g, " ").trim();
}
function normalizeSearch(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").trim();
}
function compareProducts(left: ProductCost, right: ProductCost) {
  return left.name.localeCompare(right.name, "fr", { sensitivity: "base" });
}

function createExportFiles(exported: AccountingExport) {
  const accountingRows = exported.accounting.rows.map(({ id, productId, label, liters, purchasePricePerLiter, revenue }) => ({ id, productId, label, liters, purchasePricePerLiter, revenue }));
  const accountingCsv = createAccountingCsv(exported.accounting.eventName, exported.accounting.eventDate, accountingRows, calculateTotals(accountingRows));
  const salesCsv = tableCsv(
    ["Transaction", "Date", "Membre", "Produit", "Catégorie", "Quantité", "Montant débité", "Statut"],
    exported.sales.map((sale) => [sale.orderId, formatCsvDate(sale.date), memberName(sale), sale.productName, sale.category, sale.amount, csvNumber(Math.abs(Number(sale.price)), 2), sale.status === "replacement" ? "Vente de remplacement" : "Vente"]),
  );
  const rechargesCsv = tableCsv(
    ["Transaction", "Date", "Membre", "Montant", "Paiement reçu"],
    exported.recharges.map((recharge) => [recharge.orderId, formatCsvDate(recharge.date), memberName(recharge), csvNumber(Number(recharge.amount), 2), recharge.paymentMethod === "card" ? "Carte bancaire" : recharge.paymentMethod === "cash" ? "Espèces" : "Non renseigné"]),
  );
  const correctionsCsv = tableCsv(
    ["Transaction d’origine", "Date correction", "Statut", "Produit initial", "Quantité initiale", "Produit corrigé", "Quantité corrigée", "Remboursé", "Redébité", "Variation solde", "Raison", "Administrateur"],
    exported.corrections.map((correction) => [
      correction.originalOrderId, formatCsvDate(correction.completedAt ?? correction.createdAt), correction.status === "completed" ? "Terminée" : "À vérifier",
      correction.originalProductName ?? correction.originalProductId ?? "",
      correction.originalAmount ?? "",
      correction.replacementProductName ?? (correction.replacementProductId === null ? "Annulation" : correction.replacementProductId),
      correction.replacementAmount,
      correction.refunded ?? "", correction.charged ?? "", correction.balanceChange ?? "", correction.reason, correction.adminMemberId,
    ]),
  );
  return [
    csvFile("compta.csv", accountingCsv),
    csvFile("ventes.csv", salesCsv),
    csvFile("rechargements.csv", rechargesCsv),
    csvFile("corrections.csv", correctionsCsv),
    { name: "sauvegarde-marco.json", blob: new Blob([JSON.stringify(exported, null, 2), "\n"], { type: "application/json;charset=utf-8" }) },
  ];
}

function createAccountingCsv(eventName: string, eventDate: string, rows: EditableRow[], totals: ReturnType<typeof calculateTotals>) {
  const lines: Array<Array<string | number>> = [
    ["Événement", eventName], ["Date", eventDate], [],
    ["Produit", "Litres réels", "Prix achat par litre", "Coût total", "Recettes réelles", "Résultat"],
    ...rows.map((row) => {
      const value = calculateRow(row);
      return [row.label, csvNumber(value.liters, 3), csvNumber(Number(row.purchasePricePerLiter.replace(",", ".")), 4), csvNumber(value.cost, 2), csvNumber(value.revenue, 2), csvNumber(value.result, 2)];
    }),
    ["TOTAL", csvNumber(totals.liters, 3), "", csvNumber(totals.cost, 2), csvNumber(totals.revenue, 2), csvNumber(totals.result, 2)],
  ];
  return lines.map((line) => line.map((cell) => csvCell(String(cell))).join(";")).join("\r\n");
}

function tableCsv(headers: string[], rows: Array<Array<string | number>>) {
  return [headers, ...rows].map((row) => row.map((cell) => csvCell(String(cell))).join(";")).join("\r\n");
}
function csvFile(name: string, content: string) {
  return { name, blob: new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" }) };
}
function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
function memberName(member: { memberFirstName: string | null; memberLastName: string | null; memberId: number | null }) {
  const name = [member.memberFirstName, member.memberLastName].filter(Boolean).join(" ");
  return name || (member.memberId === null ? "Membre inconnu" : `Membre ${member.memberId}`);
}
function formatCsvDate(value: string) {
  return new Date(value).toLocaleString("fr-FR");
}
function csvCell(value: string) {
  const protectedValue = /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
  return `"${protectedValue.replace(/"/g, '""')}"`;
}
function csvNumber(value: number, decimals: number) {
  return value.toFixed(decimals).replace(".", ",");
}
function decimal(value: number, decimals: number) {
  return value.toFixed(decimals).replace(/0+$/, "").replace(/\.$/, "");
}
function formatMoney(value: number) {
  return `${value.toFixed(2)} €`;
}
function formatLiters(value: number) {
  return `${value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")} L`;
}
