"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { TextInput } from "@/components/ui/Forms";
import {
  filterVehicleMakes,
  filterVehicleModels,
  type VehicleMake,
} from "@/lib/vehicles/catalog";

type Suggestion = { value: string; logo?: string };

export function VehicleBrandMark({ logo }: { logo?: string }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-50 ring-1 ring-inset ring-slate-200">
      <Image
        src={logo || "/vehicle-brands/generic-vehicle.svg"}
        alt=""
        width={22}
        height={22}
        className="size-5 object-contain"
        data-testid={logo ? "vehicle-brand-logo" : "vehicle-brand-fallback"}
      />
    </span>
  );
}

function VehicleCombobox({
  id,
  value,
  onChange,
  placeholder,
  suggestions,
  noSuggestionsText,
  showLeadingIcon = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suggestions: readonly Suggestion[];
  noSuggestionsText?: string;
  showLeadingIcon?: boolean;
}) {
  const generatedId = useId();
  const listboxId = `${id}-${generatedId.replaceAll(":", "")}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  const selectSuggestion = (suggestion: Suggestion) => {
    onChange(suggestion.value);
    setOpen(false);
    setHighlightedIndex(-1);
  };

  return (
    <div ref={rootRef} className="relative">
      <TextInput
        id={id}
        value={value}
        placeholder={placeholder}
        maxLength={60}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setHighlightedIndex(-1);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          const highlightedSuggestion = suggestions[highlightedIndex];
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            if (suggestions.length) setHighlightedIndex((current) => (current + 1) % suggestions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            if (suggestions.length) setHighlightedIndex((current) => current <= 0 || current >= suggestions.length ? suggestions.length - 1 : current - 1);
          } else if (event.key === "Enter" && open && highlightedSuggestion) {
            event.preventDefault();
            selectSuggestion(highlightedSuggestion);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            setHighlightedIndex(-1);
          } else if (event.key === "Tab") {
            setOpen(false);
          }
        }}
      />
      {open && (suggestions.length || noSuggestionsText) ? (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_45px_-24px_rgba(15,23,42,0.45)]">
          {suggestions.length ? (
            <ul id={listboxId} role="listbox" className="max-h-64 overflow-y-auto py-1.5">
              {suggestions.map((suggestion, index) => (
                <li
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  key={suggestion.value}
                  className={`mx-1.5 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--brand-navy)] transition-colors ${index === highlightedIndex ? "bg-teal-50 text-teal-900" : "hover:bg-slate-50"}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => selectSuggestion(suggestion)}
                >
                  {showLeadingIcon ? <VehicleBrandMark logo={suggestion.logo} /> : null}
                  <span>{suggestion.value}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3.5 py-3 text-xs leading-5 text-slate-500">{noSuggestionsText}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function VehicleMakeAutocomplete({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const suggestions = useMemo(
    () => filterVehicleMakes(value).map((make: VehicleMake) => ({ value: make.name, logo: make.logo })),
    [value],
  );
  return <VehicleCombobox id="make" value={value} onChange={onChange} placeholder="Toyota" suggestions={suggestions} showLeadingIcon />;
}

export function VehicleModelAutocomplete({ make, value, onChange }: { make: string; value: string; onChange: (value: string) => void }) {
  const suggestions = useMemo(
    () => filterVehicleModels(make, value).map((model) => ({ value: model })),
    [make, value],
  );
  const knownMake = suggestions.length > 0 || filterVehicleModels(make, "").length > 0;
  return (
    <VehicleCombobox
      id="model"
      value={value}
      onChange={onChange}
      placeholder="Corolla"
      suggestions={suggestions}
      noSuggestionsText={knownMake && value.trim() ? "No matching common model. You can keep your custom entry." : undefined}
    />
  );
}
