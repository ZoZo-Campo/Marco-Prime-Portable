import { useRef } from "preact/hooks";
import type { ProductSchema } from "../../../schemas/product.schema";
import { useMember } from "../../../contexts/member-context";
import { cn } from "../../../utils/cn";
import { productColors } from "../../../utils/colors";
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

  const handleClick = () => {
    onClick();
    playItemFeedback();
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
      key={product.id}
      style={{
        borderColor: color.border,
        backgroundColor: color.surface,
      }}
      class={cn(
        "relative border-[5px] justify-center items-center disabled:cursor-default cursor-pointer flex flex-col gap-2 px-3 pb-3 pt-10 hover:brightness-110 active:scale-[0.98] select-none text-card-foreground transition-all duration-150 disabled:opacity-50",
        selected && "ring-2 ring-primary ring-offset-2 shadow-lg",
      )}
      onClick={handleClick}
      disabled={!data || purchaseInteractionLockedSignal.value}
      aria-label={`${product.name}, ${product.price} euros${selected ? `, quantité ${amount}` : ""}`}
    >
      <span
        class="absolute left-3 top-3 size-6 rounded-full border-2 border-white shadow-sm"
        style={{ backgroundColor: color.swatch }}
        aria-hidden="true"
      />
      {selected && (
        <span class="absolute right-3 top-3 flex size-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground shadow-md">
          ×{amount}
        </span>
      )}
      <span class="text-xl font-extrabold text-center leading-tight line-clamp-2">
        {product.name}
      </span>
      <span class="text-lg font-bold text-card-foreground">
        {product.price}€
      </span>
    </button>
  );
}
