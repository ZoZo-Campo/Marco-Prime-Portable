import {
  ArrowLeftRight,
  ClockFading,
  Home,
  ShoppingCart,
  Wrench,
} from "lucide-preact";
import { BUY_ROUTE_URL } from "../../pages/buy";
import { CONFIG_ROUTE_URL } from "../../pages/config";
import { HOME_ROUTE_URL } from "../../pages/home";
import { HISTORY_ROUTE_URL } from "../../pages/history";
import { RECHARGE_ROUTE_URL } from "../../pages/recharge";
import { NavButton } from "../shared/navigation/nav-button";
import { SystemStatus } from "../features/system/system-status";

export function NavBar() {
  return (
    <nav class="shrink-0 px-3 pb-2.5 pt-2">
      <div class="flex items-center gap-1.5 w-full rounded-2xl border bg-card/70 backdrop-blur-md px-2.5 py-2 shadow-lg">
        <NavButton href={HOME_ROUTE_URL} label="Accueil" icon={Home} />
        <NavButton href={BUY_ROUTE_URL} label="Achats" icon={ShoppingCart} />
        <NavButton href={RECHARGE_ROUTE_URL} label="Recharger" icon={ArrowLeftRight} />
        <NavButton href={CONFIG_ROUTE_URL} label="Config" icon={Wrench} />
        <div class="flex-1" />
        <SystemStatus />
        <NavButton href={HISTORY_ROUTE_URL} label="Historique" icon={ClockFading} />
      </div>
    </nav>
  );
}
