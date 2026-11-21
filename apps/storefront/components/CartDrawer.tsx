"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useStore } from "@/components/StoreProvider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatInr } from "@/lib/productSpecs";
import { groupCartItemsBySeller } from "@/lib/commercial-policy";

const PRIORITY_DISPATCH_THRESHOLD_INR = 25000;

export function CartDrawer() {
  const {
    cart,
    cartCount,
    pricedSubtotalInr,
    hasQuoteItems,
    cartOpen,
    deliveryPincode,
    session,
    setCartOpen,
    updateCartQuantity,
    removeFromCart,
    clearCart,
  } = useStore();

  const sellerGroups = groupCartItemsBySeller(cart, {
    pincode: deliveryPincode,
    userRole: session?.role ?? null,
  });

  const dispatchProgress = Math.min(
    100,
    Math.round((pricedSubtotalInr / PRIORITY_DISPATCH_THRESHOLD_INR) * 100)
  );

  return (
    <Sheet open={cartOpen} onOpenChange={setCartOpen}>
      <SheetContent side="right" className="p-0 flex flex-col">
        <SheetHeader>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#12878F]">
            Seller-Grouped Cart · {sellerGroups.length} Group{sellerGroups.length === 1 ? "" : "s"}
          </p>
          <SheetTitle>Project Cart ({cartCount})</SheetTitle>
          <SheetDescription>
            Grouped by responsible seller. Pay or request quotes one seller group at a time.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {cart.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[#F4F6F9] border border-[#C6CAD5] text-[#153C66]">
                <ShoppingBag className="size-6" />
              </div>
              <p className="font-display text-base font-bold text-[#153C66]">
                Your BOQ cart is empty
              </p>
              <p className="text-xs text-[#7B8896] max-w-xs mx-auto leading-relaxed">
                Explore insect screens, aluminium profiles, hydraulic door closers,
                and stainless steel hardware.
              </p>
              <Button asChild onClick={() => setCartOpen(false)}>
                <Link href="/products">Explore Catalogue</Link>
              </Button>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.key}
                className="flex gap-4 rounded-xl border border-[#C6CAD5]/80 bg-white p-3.5 transition-colors hover:border-[#12878F]/60"
              >
                <Link
                  href={`/products/${item.productId}`}
                  onClick={() => setCartOpen(false)}
                  className="relative h-20 w-20 shrink-0 rounded-lg bg-[#F4F6F9] border border-[#C6CAD5]/50 p-2"
                >
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="80px"
                    className="object-contain p-1.5"
                  />
                </Link>

                <div className="flex flex-1 flex-col min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#12878F]">
                        {item.sku} · {item.category}
                      </p>
                      <Link
                        href={`/products/${item.productId}`}
                        onClick={() => setCartOpen(false)}
                        className="mt-0.5 block text-xs font-semibold text-[#153C66] hover:underline line-clamp-1"
                      >
                        {item.name}
                      </Link>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeFromCart(item.key)}
                      aria-label={`Remove ${item.name}`}
                      className="size-6 text-[#7B8896] hover:text-red-700"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>

                  <p className="mt-1 text-[11px] text-[#7B8896] line-clamp-1">
                    {item.finish} · {item.packLabel}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <div className="inline-flex items-center rounded-md border border-[#C6CAD5] bg-[#F4F6F9]">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.key, -1)}
                        aria-label="Decrease quantity"
                        className="px-2 py-1 text-[#153C66] hover:bg-white cursor-pointer"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="px-2.5 text-xs font-semibold tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.key, 1)}
                        aria-label="Increase quantity"
                        className="px-2 py-1 text-[#153C66] hover:bg-white cursor-pointer"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>

                    <span className="text-xs font-bold text-[#153C66] tabular-nums">
                      {item.unitPriceInr !== null ? (
                        formatInr(item.unitPriceInr * item.quantity)
                      ) : (
                        <Badge variant="secondary">Quote on BOQ</Badge>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <SheetFooter className="space-y-3">
            <div className="w-full space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#7B8896]">Priority Trichy / TN Dispatch Tier</span>
                <span className="font-semibold text-[#153C66]">{dispatchProgress}%</span>
              </div>
              <Progress value={dispatchProgress} />
            </div>

            <Separator />

            <div className="flex w-full items-center justify-between text-xs">
              <span className="text-[#7B8896]">Priced Items Subtotal</span>
              <span className="text-base font-bold text-[#153C66] tabular-nums">
                {formatInr(pricedSubtotalInr)}
              </span>
            </div>

            {hasQuoteItems && (
              <p className="text-[11px] text-[#12878F] font-medium">
                Includes range/custom items priced via formal BOQ quotation.
              </p>
            )}

            <div className="grid w-full grid-cols-2 gap-2.5">
              <Button
                asChild
                variant="outline-navy"
                onClick={() => setCartOpen(false)}
              >
                <Link href="/cart">View Cart</Link>
              </Button>
              <Button
                asChild
                variant="teal"
                onClick={() => setCartOpen(false)}
              >
                <Link href="/checkout">
                  Checkout <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center gap-1.5 text-[11px] font-medium text-[#7B8896] hover:text-red-700 cursor-pointer"
                >
                  <Trash2 className="size-3" />
                  Clear all items
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Project Cart?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes all {cartCount} scheduled SKUs from your current session cart. Your saved shortlist stays intact.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Items</AlertDialogCancel>
                  <AlertDialogAction onClick={clearCart}>
                    Clear Cart
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
