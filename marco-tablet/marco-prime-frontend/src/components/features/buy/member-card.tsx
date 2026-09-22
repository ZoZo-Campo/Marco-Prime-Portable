import { useEffect, useRef } from "preact/hooks";
import type z from "zod";
import { useMember } from "../../../contexts/member-context";
import { shopping } from "../../../contexts/shopping-context";
import { cn } from "../../../utils/cn";
import { RefreshCw } from "lucide-preact";
import { hasInsufficientBalance } from "../../../utils/validation";
import { playScanFeedback } from "../../../utils/scan-sound";
import type { memberSchema } from "../../../schemas/member.schema";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Button } from "../../ui/button";
import { Skeleton } from "../../ui/skeleton";
import { MemberSearch } from "../member/member-search";
import { BirthdayBadge } from "../member/birthday-badge";

export function MemberCard() {
  const { data, loading, error, inputLength, retry, clear } = useMember();
  const flashRef = useRef<HTMLDivElement>(null);
  const lastStateKey = useRef<string>("");

  useEffect(() => {
    const stateKey = error ? "error" : data ? "ok" : "idle";
    if (stateKey === lastStateKey.current) return;
    lastStateKey.current = stateKey;
    if (stateKey === "ok") {
      playScanFeedback("ok");
      flash("success");
    } else if (stateKey === "error") {
      playScanFeedback("error");
      flash("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data, error]);

  function flash(kind: "success" | "error") {
    const el = flashRef.current;
    if (!el) return;
    el.className =
      `pointer-events-none fixed inset-0 z-[100] ${kind === "success" ? "bg-green-500/20" : "bg-red-500/25"}`;
    requestAnimationFrame(() => {
      el.className = `${el.className} scanflash-anim`;
    });
    window.setTimeout(() => {
      el.className = "pointer-events-none fixed inset-0 z-[100] opacity-0";
    }, 450);
  }

  let content;
  if (loading) content = <MemberCardLoading />;
  else if (error) content = <MemberCardError retry={retry} clear={clear} />;
  else if (!data) content = <NoMemberCard inputLength={inputLength} />;
  else content = <MemberCardLoaded member={data} clear={clear} />;

  return (
    <>
      <div ref={flashRef} class="pointer-events-none fixed inset-0 z-[100] opacity-0" />
      {content}
    </>
  );
}

function MemberCardError({
  retry,
  clear,
}: {
  retry: () => Promise<void>;
  clear: () => void;
}) {
  return (
    <div>
      <Alert variant="destructive">
        <AlertTitle>Carte non reconnue</AlertTitle>
        <AlertDescription class="flex flex-col gap-2">
          <span>Vérifiez la carte ou la connexion au serveur.</span>
          <div class="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void retry()}>
              Réessayer
            </Button>
            <Button size="sm" onClick={clear}>Autre carte</Button>
          </div>
        </AlertDescription>
      </Alert>
      <MemberSearch />
    </div>
  );
}

function NoMemberCard({ inputLength }: { inputLength: number }) {
  return (
    <div>
      <Alert variant={inputLength > 0 ? "default" : "destructive"}>
        <AlertDescription>
          {inputLength > 0
            ? `Saisie en cours : ${inputLength} chiffre${inputLength > 1 ? "s" : ""}. Appuyez sur Entrée.`
            : "Veuillez scanner une carte ou saisir son numéro puis appuyer sur Entrée."}
        </AlertDescription>
      </Alert>
      <MemberSearch />
    </div>
  );
}

function MemberCardLoaded({
  member,
  clear,
}: {
  member: z.infer<typeof memberSchema>;
  clear: () => void;
}) {
  const notEnoughMoney = hasInsufficientBalance(
    shopping.total.value,
    member.balance,
  );
  const missingAmount = Math.max(
    0,
    Math.round((shopping.total.value - Number(member.balance)) * 100) / 100,
  );
  return (
    <>
      <Alert>
        <AlertTitle>
          {member.firstName} {member.lastName}
        </AlertTitle>
        <AlertDescription class={cn("space-y-1", notEnoughMoney && "text-destructive")}>
          <p>Solde : {member.balance}€</p>
          {member.isBirthday && <BirthdayBadge firstName={member.firstName} />}
          {notEnoughMoney && (
            <p class="font-semibold">
              Paiement impossible — il manque {missingAmount.toFixed(2)}€.
            </p>
          )}
        </AlertDescription>
      </Alert>
      <Button
        class="mt-2 w-full"
        type="button"
        variant="outline"
        onClick={() => {
          shopping.reset();
          clear();
        }}
      >
        <RefreshCw class="size-5" /> Changer de membre
      </Button>
    </>
  );
}

function MemberCardLoading() {
  return (
    <Alert class="flex flex-col gap-3.5 py-4">
      <Skeleton class="h-5 w-28" />
      <Skeleton class="h-4 w-16" />
    </Alert>
  );
}
