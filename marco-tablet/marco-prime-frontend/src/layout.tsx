import type { PropsWithChildren } from "preact/compat";
import { useLocation } from "preact-iso";
import { useEffect } from "preact/hooks";
import { NavBar } from "./components/layout/navbar";
import { shopping } from "./contexts/shopping-context";
import { clearTicket } from "./contexts/ticket-context";
import { HOME_ROUTE_URL } from "./pages/home";
import {
  purchaseInteractionLockedSignal,
  resetPurchaseState,
} from "./contexts/purchase-state";
import {
  rechargeInteractionLockedSignal,
  resetRechargeState,
} from "./contexts/recharge-state";

type LayoutProps = PropsWithChildren;

export function Layout({ children }: LayoutProps) {
  const { route } = useLocation();

  // Garde anti-clavier : quand le clavier se rétracte, Chrome peut laisser le
  // viewport décalé vers le bas (liseré en haut + clavier qui rejaillit au
  // prochain tap). On recentre le scroll dès que le clavier disparaît.
  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;
    let fullHeight = Math.max(window.innerHeight, visualViewport.height);
    let keyboardVisible = false;

    const onResize = () => {
      const currentInner = window.innerHeight;
      if (currentInner > fullHeight) fullHeight = currentInner;
      const hasKeyboard = fullHeight - visualViewport.height > 120;
      if (hasKeyboard) {
        keyboardVisible = true;
      } else if (keyboardVisible) {
        keyboardVisible = false;
        visualViewport.offsetTop > 0 && window.scrollTo(0, 0);
      }
    };

    const onScroll = () => {
      if (!keyboardVisible && visualViewport.offsetTop > 0) {
        window.scrollTo(0, 0);
      }
    };

    visualViewport.addEventListener("resize", onResize);
    visualViewport.addEventListener("scroll", onScroll);
    return () => {
      visualViewport.removeEventListener("resize", onResize);
      visualViewport.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    let timeout = window.setTimeout(resetSession, 120_000);

    function resetSession() {
      if (
        purchaseInteractionLockedSignal.value ||
        rechargeInteractionLockedSignal.value
      ) {
        timeout = window.setTimeout(resetSession, 120_000);
        return;
      }
      shopping.reset();
      resetPurchaseState();
      resetRechargeState();
      clearTicket();
      route(HOME_ROUTE_URL);
    }

    function refreshTimeout() {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(resetSession, 120_000);
    }

    window.addEventListener("keydown", refreshTimeout);
    window.addEventListener("pointerdown", refreshTimeout);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("keydown", refreshTimeout);
      window.removeEventListener("pointerdown", refreshTimeout);
    };
  }, []);

  return (
    <div
      class="app-shell w-screen flex flex-col overflow-hidden"
    >
      <main class="flex-1 flex overflow-auto">{children}</main>
      <NavBar />
    </div>
  );
}
