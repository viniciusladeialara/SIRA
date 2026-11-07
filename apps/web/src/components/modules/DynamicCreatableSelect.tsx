import React, { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { db } from "@/lib/db";
import { doc, updateDoc, arrayUnion } from "@/lib/sira-sql-adapter";
import { useToast } from '@/hooks/use-toast';

interface DynamicCreatableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  emptyMessage?: string;
  unitId: string;
  metadataKey: 'blocks' | 'floors' | 'roomTypes' | 'shifts';
  label: string; // Ex: "Bloco", "Andar", "Tipo de Ambiente", "Turno"
}

export function DynamicCreatableSelect({
  value,
  onValueChange,
  options = [],
  placeholder = "Selecione...",
  emptyMessage = "Nenhum item encontrado.",
  unitId,
  metadataKey,
  label
}: DynamicCreatableSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateNew = async (newVal: string) => {
    const trimmed = newVal.trim();
    if (!trimmed) return;
    
    // Se a opção já existe, apenas seleciona
    const existing = options.find(opt => opt.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      onValueChange(existing);
      setOpen(false);
      return;
    }
    
    setIsCreating(true);
    try {
      const docRef = doc(db, "units", unitId);
      await updateDoc(docRef, {
        [`metadata.${metadataKey}`]: arrayUnion(trimmed)
      });
      toast({
        title: "Sucesso",
        description: `Novo ${label.toLowerCase()} "${trimmed}" adicionado com sucesso!`
      });
      onValueChange(trimmed);
      setOpen(false);
    } catch (error) {
      console.error("Erro ao adicionar nova opção:", error);
      toast({
        title: "Erro",
        description: `Não foi possível criar o novo ${label.toLowerCase()}.`,
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
      setSearchValue('');
    }
  };

  const showCreateOption = searchValue.trim() !== '' && !options.some(opt => opt.toLowerCase() === searchValue.toLowerCase().trim());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal text-left"
          disabled={isCreating}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full min-w-[200px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder={`Buscar ou criar ${label.toLowerCase()}...`}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>
              {emptyMessage}
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={(currentValue) => {
                    const originalOpt = options.find(o => o.toLowerCase() === currentValue.toLowerCase()) || opt;
                    onValueChange(originalOpt);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === opt ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
            {showCreateOption && (
              <CommandGroup heading="Ações">
                <CommandItem
                  value={searchValue}
                  onSelect={() => handleCreateNew(searchValue)}
                  className="text-primary font-medium cursor-pointer"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Criar "{searchValue.trim()}"
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
