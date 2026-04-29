"use client";

const CATEGORIES = ["Feeding", "Diapering", "Maternity", "Clothing", "Hygiene", "Recovery", "Travel"];
const CONDITIONS = ["New", "Sealed", "Gently used", "Opened but safe"];
const DISTANCES = ["Under 1km", "Under 3km", "Under 5km", "Any"];

interface FilterSheetProps {
  category: string;
  condition: string;
  onCategoryChange: (c: string) => void;
  onConditionChange: (c: string) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
}

export default function FilterSheet({
  category, condition,
  onCategoryChange, onConditionChange,
  onApply, onClear, onClose,
}: FilterSheetProps) {
  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-title">Filters</div>

        <div className="filter-group">
          <div className="filter-group-label">Category</div>
          <div className="filter-chips">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                className={`filter-chip ${category === c ? "active" : ""}`}
                onClick={() => onCategoryChange(category === c ? "All" : c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <div className="filter-group-label">Condition</div>
          <div className="filter-chips">
            {CONDITIONS.map((c) => (
              <button
                key={c}
                className={`filter-chip ${condition === c ? "active" : ""}`}
                onClick={() => onConditionChange(condition === c ? "" : c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <div className="filter-group-label">Distance</div>
          <div className="filter-chips">
            {DISTANCES.map((d) => (
              <button key={d} className="filter-chip">{d}</button>
            ))}
          </div>
        </div>

        <div className="sheet-footer">
          <button className="btn-clear" onClick={onClear}>Clear all</button>
          <button className="btn-apply" onClick={onApply}>Show results</button>
        </div>
      </div>
    </>
  );
}
