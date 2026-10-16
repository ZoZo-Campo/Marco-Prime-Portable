import { ProductTabs } from "../components/features/buy/product-tabs";
import { ProductGrid } from "../components/features/buy/product-grid";
import { Receipt } from "../components/features/buy/receipt";
import { MemberProvider } from "../contexts/member-context";
import { purchaseInteractionLockedSignal } from "../contexts/purchase-state";

export const BUY_ROUTE_URL = "/buy";

export function BuyPage() {
  return (
    <MemberProvider disabled={purchaseInteractionLockedSignal.value}>
      <div class="grid grid-cols-[minmax(0,1fr)_clamp(340px,24%,420px)] flex-1 min-h-0 overflow-hidden">
        <div class="px-6 py-5 flex flex-col gap-4 min-h-0 overflow-hidden">
          <ProductTabs />
          <ProductGrid />
        </div>
        <Receipt />
      </div>
    </MemberProvider>
  );
}
