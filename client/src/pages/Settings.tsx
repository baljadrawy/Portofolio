import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SettingsPage, type ApiConnection } from "@/components/SettingsPage";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertConnection } from "@shared/schema";

export default function Settings() {
  const { toast } = useToast();
  
  const { data: connectionsData } = useQuery<Array<{ id: string; name: string; type: string; apiKey: string | null }>>({
    queryKey: ['/api/connections'],
  });

  const connections: ApiConnection[] = connectionsData?.map(conn => ({
    id: conn.id,
    name: conn.name,
    type: conn.type as 'wallet' | 'exchange',
    hasApiKey: !!conn.apiKey
  })) || [];

  const handleAddConnection = async (type: 'wallet' | 'exchange', data: { name?: string; address?: string; apiKey?: string; apiSecret?: string }) => {
    try {
      const name = data.name?.trim() || (type === 'wallet' ? 'New Wallet' : 'New Exchange');
      
      const payload: Partial<InsertConnection> = {
        name,
        type,
        status: 'synced' as const,
      };

      if (type === 'wallet' && data.address?.trim()) {
        payload.address = data.address.trim();
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

  return (
    <SettingsPage
      connections={connections}
      onAddConnection={handleAddConnection}
      onRemoveConnection={handleRemoveConnection}
    />
  );
}
