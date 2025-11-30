import React, { useMemo, useState } from "react";

export type MultiSelectOption = {
  value: string;
  label: string;
};

type MultiSelectFilterProps = {
  label: string;
  placeholder?: string;
  options: MultiSelectOption[];
  selectedValues: string[] | null;
  onChange: (values: string[] | null) => void;
};

const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  placeholder = "Keyword",
  options,
  selectedValues,
  onChange,
}) => {
  const [search, setSearch] = useState("");

  const selectedSet = useMemo(
    () => new Set(selectedValues ?? []),
    [selectedValues]
  );

  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(term)
    );
  }, [options, search]);

  const trimmedSearch = search.trim();
  const showDropdown =
    trimmedSearch.length > 0 && filteredOptions.length > 0;

  const toggleValue = (value: string) => {
    const current = new Set(selectedSet);
    if (current.has(value)) {
      current.delete(value);
    } else {
      current.add(value);
    }
    const next = Array.from(current);
    onChange(next.length ? next : null);
    setSearch(""); // hides dropdown after selection
  };

  const removeValue = (value: string) => {
    const current = new Set(selectedSet);
    current.delete(value);
    const next = Array.from(current);
    onChange(next.length ? next : null);
  };

  const hasSelection = selectedSet.size > 0;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>

      {/* Search + list */}
      <div className="border border-gray-300 rounded-md relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="w-full border-b border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-0"
        />

        {/* Dropdown list - absolute positioned to overlay chips */}
        {showDropdown && (
          <div
            className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto text-sm bg-white border border-gray-200 rounded-md shadow-lg z-20"
          >
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-gray-400 text-xs">
                No options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedSet.has(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleValue(opt.value)}
                    className={`w-full text-left px-3 py-2 flex justify-between items-center hover:bg-gray-50 ${
                      isSelected ? "bg-secondary/5" : ""
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && (
                      <span className="text-xs text-secondary font-semibold">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Selected chips */}
        {hasSelection && (
          <div className="flex flex-wrap gap-2 p-2 bg-gray-50 mt-2">
            {options
              .filter((opt) => selectedSet.has(opt.value))
              .map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => removeValue(opt.value)}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary/10 text-secondary px-3 py-1 text-xs font-medium hover:bg-secondary/20"
                >
                  <span>{opt.label}</span>
                  <span className="text-xs" aria-hidden="true">
                    ×
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiSelectFilter;

