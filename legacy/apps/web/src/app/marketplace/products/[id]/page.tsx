// apps/web/src/app/marketplace/products/[id]/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ChevronLeft, ShoppingCart, Package, Store,
  ChevronLeft as ChevronLeftIcon, ChevronRight,
  Star, Shield, Truck,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/useToast';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get(`/api/v1/marketplace/products/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const addToCartMutation = useMutation({
    mutationFn: () =>
      api.post('/api/v1/marketplace/cart', {
        productId: id,
        quantity,
      }).then((r) => r.data),
    onSuccess: () => {
      toast({ title: '✓ Added to cart', description: `${product?.title} × ${quantity}` });
    },
    onError: (err: any) => {
      toast({ title: '✗ Error', description: err?.response?.data?.message || 'Could not add to cart' });
    },
  });

  if (isLoading) return (
    <div className="pt-16 min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!product) return (
    <div className="pt-16 min-h-screen flex items-center justify-center">
      <p className="font-body text-charcoal-400">Product not found.</p>
    </div>
  );

  const images = product.images || [];
  const inStock = product.stockQty > 0;

  return (
    <div className="pt-16 min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-charcoal-100 px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-2 text-sm font-body text-charcoal-400">
          <Link href="/marketplace" className="hover:text-gold transition-colors">Marketplace</Link>
          <span>›</span>
          {product.category && (
            <>
              <span>{product.category.name}</span>
              <span>›</span>
            </>
          )}
          <span className="text-navy">{product.title}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Images */}
          <div>
            {/* Main image */}
            <div className="aspect-square bg-white rounded-2xl border border-charcoal-100 shadow-card overflow-hidden mb-3">
              {images[activeImage]?.mediaAsset?.url ? (
                <motion.img
                  key={activeImage}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  src={images[activeImage].mediaAsset.url}
                  alt={product.title}
                  className="w-full h-full object-contain p-4"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-20 h-20 text-charcoal-200" />
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((img: any, i: number) => (
                  <button
                    key={img.id}
                    onClick={() => setActiveImage(i)}
                    className={cn(
                      'w-16 h-16 rounded-xl border-2 overflow-hidden flex-shrink-0 transition-all',
                      i === activeImage ? 'border-gold' : 'border-charcoal-100',
                    )}
                  >
                    <img src={img.mediaAsset?.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product info */}
          <div>
            {/* Store */}
            <Link
              href={`/marketplace?storeId=${product.store?.id}`}
              className="flex items-center gap-2 text-sm font-body text-gold-700 hover:text-gold transition-colors mb-3"
            >
              <Store className="w-4 h-4" />
              {product.store?.name}
            </Link>

            <h1 className="font-heading font-bold text-navy text-3xl mb-2">{product.title}</h1>

            {/* Price */}
            <div className="flex items-center gap-3 mb-6">
              <p className="font-heading font-bold text-navy text-4xl">
                R{Number(product.price).toFixed(2)}
              </p>
              {!inStock && (
                <span className="text-sm font-body text-charcoal-400 bg-charcoal-100 px-3 py-1 rounded-full">
                  Out of Stock
                </span>
              )}
              {inStock && product.stockQty <= 5 && (
                <span className="text-sm font-body text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                  Only {product.stockQty} left
                </span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="font-body text-charcoal-600 text-sm leading-relaxed mb-6 whitespace-pre-line">
                {product.description}
              </p>
            )}

            {/* Quantity + Add to cart */}
            {inStock && (
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center border border-charcoal-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-4 py-3 text-charcoal-600 hover:bg-charcoal-50 transition-colors font-body"
                  >−</button>
                  <span className="px-4 py-3 font-body font-semibold text-navy min-w-[3rem] text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stockQty, quantity + 1))}
                    className="px-4 py-3 text-charcoal-600 hover:bg-charcoal-50 transition-colors font-body"
                  >+</button>
                </div>

                <button
                  onClick={() => addToCartMutation.mutate()}
                  disabled={addToCartMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-gold text-navy font-body font-bold py-3 rounded-xl hover:bg-gold-600 transition-all shadow-gold hover:-translate-y-0.5 disabled:opacity-50"
                >
                  <ShoppingCart className="w-5 h-5" />
                  {addToCartMutation.isPending ? 'Adding...' : 'Add to Cart'}
                </button>
              </div>
            )}

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 pt-6 border-t border-charcoal-100">
              {[
                { icon: Shield, label: 'Verified Seller' },
                { icon: Truck,  label: 'Seller Arranges' },
                { icon: Star,   label: 'Community Rated' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-1.5 text-center">
                  <Icon className="w-5 h-5 text-gold" />
                  <span className="text-xs font-body text-charcoal-400">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
