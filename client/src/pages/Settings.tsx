import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SettingsPage, type ApiConnection } from "@/components/SettingsPage";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

  const handleAddConnection = async (type: 'wallet' | 'exchange') => {
    try {
      const name = type === 'wallet' ? 'New Wallet' : 'New Exchange';
      
      const response = await fetch('/api/connections', {
        method: 'POST',
        body: JSON.stringify({
          name,
          type,
          status: 'synced',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to add connection');
      }

      await queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/portfolio/summary'] });

      toast({
        title: "Success",
        description: `${type === 'wallet' ? 'Wallet' : 'Exchange'} added successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add connection",
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
