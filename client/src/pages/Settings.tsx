import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SettingsPage, type ApiConnection } from "@/components/SettingsPage";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertConnection } from "@shared/schema";
import { CHAIN_NAMES, CHAIN_ABBREVIATIONS } from "@shared/networks";
import { groupConnectionsByAddress } from "@/lib/groupConnections";

export default function Settings() {
  const { toast } = useToast();
  
  const { data: connectionsData } = useQuery<Array<{ id: string; name: string; type: string; chainId?: number | null; apiKey: string | null; address?: string | null }>>({
    queryKey: ['/api/connections'],
  });

  const rawConnections = connectionsData || [];
  
  const groupedConnections = groupConnectionsByAddress(
    rawConnections.map(conn => ({
      id: conn.id,
      name: conn.name,
      type: conn.type,
      address: conn.address,
      chainId: conn.chainId,
      status: 'synced',
      lastSync: null
    })),
    []
  );

  const connections: ApiConnection[] = groupedConnections.map(group => ({
    id: group.groupId,
    name: group.name,
    type: group.type,
    chainId: undefined,
    hasApiKey: group.type === 'exchange' && rawConnections.some(c => c.id === group.connectionIds[0] && !!c.apiKey),
    address: group.address,
    connectionIds: group.connectionIds,
    chainBadges: group.chainBadges
  }));

  const handleAddConnection = async (type: 'wallet' | 'exchange', data: { name?: string; address?: string; chainId?: number; apiKey?: string; apiSecret?: string }) => {
    try {
      if (type === 'wallet') {
        const address = data.address?.trim();
        
        if (!address) {
          toast({
            title: "خطأ",
            description: "يرجى إدخال عنوان المحفظة",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "جاري الفحص...",
          description: "جاري فحص العنوان على 19 شبكة. قد يستغرق 20-25 ثانية...",
        });

        try {
          const response: any = await apiRequest('POST', '/api/wallet/scan-all-networks', { address });

          await queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
          await queryClient.invalidateQueries({ queryKey: ['/api/portfolio/summary'] });

          if (response.connections && response.connections.length > 0) {
            const networkNames = response.connections.map((c: any) => 
              c.chainId && CHAIN_NAMES[c.chainId] ? CHAIN_NAMES[c.chainId] : 'Unknown'
            ).join(', ');
            
            if (response.failedNetworks && response.failedNetworks.length > 0) {
              const failedNames = response.failedNetworks.map((f: any) => f.network).join(', ');
              
              toast({
                title: "تحذير: فحص جزئي",
                description: `تم العثور على المحفظة في ${response.networksWithData} شبكة: ${networkNames}\n\nفشل فحص ${response.failedNetworks.length} شبكة: ${failedNames}\n\nقد تكون Etherscan API محدودة. جرب المزامنة لاحقاً.`,
                variant: "destructive",
              });
            } else {
              toast({
                title: "تم بنجاح",
                description: `تم العثور على المحفظة في ${response.networksWithData} شبكة: ${networkNames}`,
              });
            }
          } else if (response.error) {
            toast({
              title: "خطأ في الفحص",
              description: response.message || "فشل فحص جميع الشبكات. قد تكون Etherscan API محدودة مؤقتاً. حاول مرة أخرى بعد قليل.",
              variant: "destructive",
            });
          } else {
            let description = "هذا العنوان ليس لديه رصيد أو عملات في أي من الشبكات المدعومة";
            
            if (response.emptyNetworks && response.emptyNetworks.length > 0) {
              description += `\n\nالشبكات المفحوصة: ${response.emptyNetworks.join(', ')}`;
            }
            
            toast({
              title: "لم يتم العثور على بيانات",
              description,
            });
          }
        } catch (error: any) {
          const errorData = error?.data || error;
          
          if (errorData?.error && errorData.error.includes('API errors')) {
            toast({
              title: "خطأ في الاتصال",
              description: "Etherscan API قد يكون محدوداً مؤقتاً. حاول مرة أخرى بعد دقيقة.",
              variant: "destructive",
            });
          } else {
            throw error;
          }
        }
      } else {
        const name = data.name?.trim() || 'New Exchange';
        
        const payload: Partial<InsertConnection> = {
          name,
          type: 'exchange',
          status: 'synced' as const,
        };

        if (data.apiKey?.trim()) {
          payload.apiKey = data.apiKey.trim();
        }
        if (data.apiSecret?.trim()) {
          payload.apiSecret = data.apiSecret.trim();
        }
        
        await apiRequest('POST', '/api/connections', payload);

        await queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/portfolio/summary'] });

        toast({
          title: "تم بنجاح",
          description: "تم إضافة البورصة بنجاح",
        });
      }
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل إضافة الاتصال. تأكد من صحة البيانات المدخلة.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveConnection = async (groupId: string) => {
    try {
      const group = connections.find(c => c.id === groupId);
      const connectionIdsToDelete = group?.connectionIds || [groupId];

      for (const id of connectionIdsToDelete) {
        const response = await fetch(`/api/connections/${id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete');
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/portfolio/summary'] });

      toast({
        title: "تم بنجاح",
        description: connectionIdsToDelete.length > 1 
          ? `تم حذف ${connectionIdsToDelete.length} اتصال من الشبكات المختلفة`
          : "تم حذف الاتصال بنجاح",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل حذف الاتصال",
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
        description: `تم جلب ${result.tokensCount} توكن و ${result.transactionsCount} معاملة من شبكة ${networkName}`,
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
