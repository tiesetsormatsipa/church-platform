// apps/web/src/app/admin/marketplace/page.tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag, CheckCircle2, XCircle, Package, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from '@/hooks/useToast';

function ApprovalCard({ item, type, onApprove, onReject }: any) {
  const [notes, setNotes] = useState('');
  const [rejecting, setRejecting] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-card p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-xl bg-charcoal-50 overflow-hidden flex-shrink-0">
            {item.images?.[0]?.mediaAsset?.url ? (
              <img src={item.images[0].mediaAsset.url} alt={item.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-6 h-6 text-charcoal-300" />
              </div>
            )}
          </div>
          <div>
            <p className="font-heading font-bold text-navy text-base">{item.title}</p>
            <p className="font-body text-charcoal-500 text-sm">by {item.store?.name}</p>
            <p className="font-body text-gold-700 font-semibold text-sm mt-1">R{Number(item.price).toFixed(2)}</p>
          </div>
        </div>
        <span className="text-xs font-body text-charcoal-400 flex-shrink-0">
          {item.createdAt && format(new Date(item.createdAt), 'dd MMM yyyy')}
        </span>
      </div>

      {item.description && (
        <p className="font-body text-charcoal-500 text-sm line-clamp-2 mb-4">{item.description}</p>
      )}

      {rejecting ? (
        <div className="space-y-2">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Rejection reason..."
            className="w-full px-3 py-2 border border-charcoal-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-gold/30"
          />
          <div className="flex gap-2">
            <button onClick={() => { onReject(item.id, notes); setRejecting(false); setNotes(''); }}
              disabled={!notes.trim()}
              className="flex-1 py-2 bg-church-red text-white text-sm font-body font-semibold rounded-xl hover:bg-red-800 transition-colors disabled:opacity-50">
              Confirm Rejection
            </button>
            <button onClick={() => { setRejecting(false); setNotes(''); }}
              className="px-4 py-2 border border-charcoal-200 rounded-xl text-sm font-body hover:bg-charcoal-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => onApprove(item.id)}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white text-sm font-body font-semibold py-2.5 rounded-xl hover:bg-green-700 transition-colors">
            <CheckCircle2 className="w-4 h-4" /> Approve
          </button>
          <button onClick={() => setRejecting(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-church-red text-sm font-body font-semibold py-2.5 rounded-xl border border-red-200 hover:bg-red-100 transition-colors">
            <XCircle className="w-4 h-4" /> Reject
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminMarketplacePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'products' | 'stores'>('products');

  const { data: pendingProducts = [], isLoading } = useQuery({
    queryKey: ['admin-pending-products'],
    queryFn: () => api.get('/api/v1/marketplace/admin/pending-products').then((r) => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.post(`/api/v1/marketplace/admin/products/${id}/approve`, { notes }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-pending-products'] });
      toast({ title: '✓ Product approved and published' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/api/v1/marketplace/admin/products/${id}/reject`, { reason }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-pending-products'] });
      toast({ title: '⊘ Product rejected' });
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading font-bold text-navy text-3xl mb-1">Marketplace Admin</h1>
          <p className="font-body text-charcoal-500 text-sm">Review and approve marketplace products and seller stores.</p>
        </div>
        {pendingProducts.length > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-body px-4 py-2 rounded-xl">
            <Clock className="w-4 h-4" /> {pendingProducts.length} pending
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-48 skeleton rounded-2xl" />)}
        </div>
      ) : pendingProducts.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingBag className="w-12 h-12 text-charcoal-200 mx-auto mb-3" />
          <p className="font-body text-charcoal-400">No pending products to review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(pendingProducts as any[]).map((product) => (
            <ApprovalCard
              key={product.id}
              item={product}
              type="product"
              onApprove={(id: string) => approveMutation.mutate({ id })}
              onReject={(id: string, reason: string) => rejectMutation.mutate({ id, reason })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
