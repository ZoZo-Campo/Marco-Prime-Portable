import { useLocation } from "preact-iso";
import { BUY_ROUTE_URL } from "./buy";
import { shopping } from "../contexts/shopping-context";
import { resetPurchaseState } from "../contexts/purchase-state";
import { resetRechargeState } from "../contexts/recharge-state";

export const HOME_ROUTE_URL = "/";

export function HomePage() {
  const { route } = useLocation();
  return (
    <div class="flex-1 min-h-0 flex flex-col">
      <button
        type="button"
        class="flex-1 min-h-0 flex flex-col justify-center items-center cursor-pointer gap-3 sm:gap-5"
        onClick={() => {
          shopping.reset();
          resetPurchaseState();
          resetRechargeState();
          route(BUY_ROUTE_URL);
        }}
      >
        <img src="/marco.svg" alt="Marco Logo" class="h-24 sm:h-40" />
        <div class="flex items-end gap-2">
          <span class="text-lg sm:text-2xl">Powered by</span>
          <img src="/enzo-romain.png" alt="Enzo et Romain" class="h-20 w-auto object-contain sm:h-28" />
        </div>
      </button>
      <footer class="shrink-0 px-3 pb-2 text-center text-xs font-medium text-muted-foreground sm:pb-3 sm:text-sm">
        <span class="block">© {new Date().getFullYear()} Enzo Campofranco &amp; Romain Bourdinho · Marco Prime</span>
        <span class="block text-xs">L’homme de la situation · L’inoubliable</span>
      </footer>
    </div>
  );
}
