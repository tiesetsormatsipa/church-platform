// apps/web/src/app/marketplace/page.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Search, ShoppingBag, Star, ShoppingCart, Heart,
  Package, ChevronRight, SlidersHorizontal, X,
} from 'lucide-react';
import Link from 'next/link';
import { FeatureGate } from '@/components/layout/FeatureGate';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

function ProductCard({ product, index }: { product: any; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
    >
      <Link href={`/marketplace/products/${product.id}`}>
        <div className="group bg-white rounded-2xl border border-charcoal-100 shadow-card overflow-hidden hover:shadow-gold hover:border-gold/30 transition-all duration-200 hover:-translate-y-1">
          {/* Product image */}
          <div className="relative aspect-square bg-charcoal-50 overflow-hidden">
            {product.images?.[0]?.mediaAsset?.url ? (
              <img
                src={product.images[0].mediaAsset.url}
                alt={product.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-10 h-10 text-charcoal-300" />
              </div>
            )}
            <button className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:text-church-red">
              <Heart className="w-4 h-4" />
            </button>
            {product.stockQty === 0 && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="bg-white text-charcoal-600 text-xs font-body font-semibold px-3 py-1 rounded-full">
                  Out of Stock
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-4">
            <div className="mb-1">
              <p className="text-xs text-charcoal-400 font-body mb-0.5">{product.store?.name}</p>
              <h3 className="font-body font-semibold text-navy text-sm leading-snug line-clamp-2">
                {product.title}
              </h3>
            </div>

            <div className="flex items-center justify-between mt-3">
              <span className="font-heading font-bold text-navy text-lg">
                R{Number(product.price).toFixed(2)}
              </span>
              <button
                className={cn(
                  'flex items-center gap-1.5 text-xs font-body font-semibold px-3 py-1.5 rounded-lg transition-all',
                  product.stockQty > 0
                    ? 'bg-gold text-navy hover:bg-gold-600'
                    : 'bg-charcoal-100 text-charcoal-400 cursor-not-allowed',
                )}
                disabled={product.stockQty === 0}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            {product.stockQty > 0 && product.stockQty <= 5 && (
              <p className="text-xs text-amber-600 font-body mt-1.5">
                Only {product.stockQty} left
              </p>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function MarketplacePage() {
  return (
    <FeatureGate featureKey="marketplace">
      <MarketplaceContent />
    </FeatureGate>
  );
}

function MarketplaceContent() {
  const [search, setSearch]         = useState('');
  const [categoryFilter, setCategory] = useState('all');
  const [page, setPage]             = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, categoryFilter, page],
    queryFn: () =>
      api.get('/api/v1/marketplace/products', {
        params: {
          search: search || undefined,
          categoryId: categoryFilter !== 'all' ? categoryFilter : undefined,
          status: 'PUBLISHED',
          page,
          limit: 16,
        },
      }).then((r) => r.data),
  });

  const { data: categories } = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => api.get('/api/v1/marketplace/categories').then((r) => r.data),
  });

  const products = data?.data || [];
  const meta     = data?.meta;

  return (
    <div className="pt-16 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-navy-gradient py-14 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 church-pattern opacity-10" />
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gold-gradient" />
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-0.5 bg-gold" />
              <span className="text-gold text-sm font-body uppercase tracking-wider">
                Community Store
              </span>
            </div>
            <h1 className="font-heading font-bold text-white text-5xl mb-3">Marketplace</h1>
            <p className="text-white/60 font-body text-lg">
              Support verified community businesses. Shop with faith.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-charcoal-100 sticky top-16 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2.5 border border-charcoal-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategory('all')}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-body font-medium transition-all',
                categoryFilter === 'all' ? 'bg-navy text-white' : 'bg-charcoal-50 text-charcoal-600 hover:bg-charcoal-100',
              )}
            >
              All
            </button>
            {(categories || []).map((cat: any) => (
              <button
                key={cat.id}
                onClick={() => { setCategory(cat.id); setPage(1); }}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs font-body font-medium transition-all',
                  categoryFilter === cat.id ? 'bg-navy text-white' : 'bg-charcoal-50 text-charcoal-600 hover:bg-charcoal-100',
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <span className="sm:ml-auto text-xs text-charcoal-400 font-body self-center">
            {meta?.total ?? 0} products
          </span>
        </div>
      </div>

      {/* Products grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-square skeleton rounded-2xl" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="w-12 h-12 text-charcoal-200 mx-auto mb-3" />
            <p className="font-body text-charcoal-400">No products found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {products.map((p: any, i: number) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-10">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 border border-charcoal-200 rounded-lg text-sm font-body disabled:opacity-40 hover:border-gold/40 transition-colors">
              Previous
            </button>
            <span className="px-4 py-2 text-sm font-body text-charcoal-500">{page} / {meta.totalPages}</span>
            <button disabled={page === meta.totalPages} onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 border border-charcoal-200 rounded-lg text-sm font-body disabled:opacity-40 hover:border-gold/40 transition-colors">
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
