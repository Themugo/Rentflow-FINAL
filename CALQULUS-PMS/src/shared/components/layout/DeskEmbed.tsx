/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from "react";

type DeskEmbedValue = {
  embedded: boolean;
  recordsHome?: string;
  propertyBase?: string;
};

const DeskEmbedContext = createContext<DeskEmbedValue>({ embedded: false });

export function deskPropertyPath(
  propertyId: string,
  options?: { propertyBase?: string; query?: string },
): string {
  const base = `${options?.propertyBase ?? "/properties"}/${propertyId}`;
  return options?.query ? `${base}?${options.query}` : base;
}

export function DeskEmbedProvider({
  children,
  recordsHome,
  propertyBase,
}: {
  children: ReactNode;
  recordsHome?: string;
  propertyBase?: string;
}) {
  return (
    <DeskEmbedContext.Provider value={{ embedded: true, recordsHome, propertyBase }}>
      {children}
    </DeskEmbedContext.Provider>
  );
}

export function useDeskEmbed(): DeskEmbedValue {
  return useContext(DeskEmbedContext);
}
