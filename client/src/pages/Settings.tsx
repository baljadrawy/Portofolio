import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SettingsPage, type ApiConnection } from "@/components/SettingsPage";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertConnection } from "@shared/schema";
import { CHAIN_NAMES } from "@shared/networks";

export default function Settings() {
  const { toast } = useToast();
  
  const { data: connectionsData } = useQuery<Array<{ id: string; name: string; type: string; chainId?: number | null; apiKey: string | null }>>({
    queryKey: ['/api/connections'],
  });

  const connections: ApiConnection[] = connectionsData?.map(conn => ({
    id: conn.id,
    name: conn.name,
    type: conn.type as 'wallet' | 'exchange',
    chainId: conn.chainId ?? undefined,
    hasApiKey: !!conn.apiKey
  })) || [];

  const handleAddConnection = async (type: 'wallet' | 'exchange', data: { name?: string; address?: string; chainId?: number; apiKey?: string; apiSecret?: string }) => {
    try {
      const name = data.name?.trim() || (type === 'wallet' ? 'New Wallet' : 'New Exchange');
      
      const payload: Partial<InsertConnection> = {
        name,
        type,
        status: 'synced' as const,
      };

      if (type === 'wallet') {
        if (data.address?.trim()) {
          payload.address = data.address.trim();
        }
        if (data.chainId) {
          payload.chainId = data.chainId;
        }
      }

      if (type === 'exchange') {
        if (data.apiKey?.trim()) {
          payload.apiKey = data.apiKey.trim();
        }
        if (data.apiSecret?.trim()) {
          payload.apiSecret = data.apiSecret.trim();
        }
      }
      
      await apiRequest('POST', '/api/connections', payload);

      await queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/portfolio/summary'] });

      toast({
        title: "تم بنجاح",
        description: `تم إضافة ${type === 'wallet' ? 'المحفظة' : 'البورصة'} بنجاح`,
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل إضافة الاتصال. تأكد من صحة البيانات المدخلة.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveConnection = async (id: string) => {
    try {
      const response = await fetch(`/api/connections/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete');
      }

      await queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/portfolio/summary'] });

      toast({
        title: "Success",
        description: "Connection removed successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove connection",
        variant: "destructive",
      });
    }
  };

  const handleSyncWallet = async (connectionId: string) => {
    try {
      const connection = connections.find(c => c.id === connectionId);
      const networkName = connection?.chainId && CHAIN_NAMES[connection.chainId] 
        ? CHAIN_NAMES[connection.chainId] 
        : 'الإيثريوم';
      
      toast({
        title: "جاري المزامنة",
        description: `جاري جلب البيانات من شبكة ${networkName}...`,
      });

      const response = await fetch(`/api/wallet/sync/${connectionId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to sync');
      }

      const result = await response.json();

      await queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/portfolio/summary'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/holdings'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });

      toast({
        title: "تمت المزامنة بنجاح",
        description: `تم جلب ${result.tokensCount} توكن و ${result.transactionsCount} معاملة من المحفظة`,
      });
    } catch (error) {
      toast({
        title: "خطأ في المزامنة",
        description: "فشل جلب البيانات من الشبكة. تأكد من صحة عنوان المحفظة ومفتاح API.",
        variant: "destructive",
      });
    }
  };

  return (
    <SettingsPage
      connections={connections}
      onAddConnection={handleAddConnection}
      onRemoveConnection={handleRemoveConnection}
      onSyncWallet={handleSyncWallet}
    />
  );
}
