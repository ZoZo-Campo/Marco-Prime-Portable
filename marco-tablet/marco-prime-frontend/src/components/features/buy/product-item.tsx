import { useRef } from "preact/hooks";
import type { ProductSchema } from "../../../schemas/product.schema";
import { useMember } from "../../../contexts/member-context";
import { productColors } from "../../../utils/colors";
import { formatEuro } from "../../../utils/format";
import { haptic, ripple } from "../../../utils/feedback";
import { playItemFeedback } from "../../../utils/scan-sound";
import { purchaseInteractionLockedSignal } from "../../../contexts/purchase-state";

interface ProductItemProps {
  product: ProductSchema;
  amount: number;
  onClick: () => void;
}

export function ProductItem({ product, amount, onClick }: ProductItemProps) {
  const { data } = useMember();
  const color = productColors(product.color, product.productTypeId);
  const selected = amount > 0;
  const flashRef = useRef<HTMLButtonElement>(null);

  const handleClick = (event: MouseEvent) => {
    if (!data || purchaseInteractionLockedSignal.value) return;
    onClick();
    playItemFeedback();
    haptic(12);
    ripple(event, color.swatch);

    const button = flashRef.current;
    if (button) {
      button.classList.remove("itemflash-anim");
      void button.offsetWidth;
      button.classList.add("itemflash-anim");
    }
  };

  return (
    <button
      ref={flashRef}
      style={{
        borderColor: color.border,
        backgroundColor: color.surface,
      }}
      class="relative overflow-hidden flex flex-col justify-center items-center gap-3 rounded-3xl border-[6px] px-5 pb-4 pt-12 select-none text-card-foreground shadow-md active:scale-[0.97] active:brightness-110 transition-[transform,filter,box-shadow] duration-150 disabled:cursor-default disabled:opacity-40 disabled:active:scale-100 cursor-pointer"
      onClick={handleClick}
      disabled={!data || purchaseInteractionLockedSignal.value}
      aria-label={`${product.name}, ${formatEuro(product.price)}${selected ? `, quantité ${amount}` : ""}`}
    >
      {/* Halo coloré en haut de tuile */}
      <span
        class="pointer-events-none absolute -inset-x-10 -top-20 h-32 rounded-full blur-2xl"
        style={{ backgroundColor: color.swatch, opacity: 0.2 }}
        aria-hidden="true"
      />

      <span
        class="absolute left-3 top-3 size-5 rounded-full border-2 border-white/80 shadow-sm"
        style={{ backgroundColor: color.swatch }}
        aria-hidden="true"
      />

      {selected && (
        <span class="absolute right-3 top-3 flex size-10 items-center justify-center rounded-full bg-primary text-lg font-extrabold text-primary-foreground shadow-md">
          ×{amount}
        </span>
      )}

      <span class="relative text-2xl font-extrabold text-center leading-tight line-clamp-2 px-1">
        {product.name}
      </span>
      <span class="relative rounded-full bg-background/60 px-5 py-2 text-3xl font-bold shadow-sm">
        {formatEuro(product.price)}
      </span>
    </button>
  );
}
