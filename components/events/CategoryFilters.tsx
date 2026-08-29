'use client';

import React from 'react';
import { clsx } from 'clsx';

export interface CategoryFiltersProps {
  categories?: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

const DEFAULT_CATEGORIES = ['All', 'My feed', 'Live', 'Food', 'Concert', 'Salles', 'Festivals'];

export const CategoryFilters: React.FC<CategoryFiltersProps> = ({
  categories = DEFAULT_CATEGORIES,
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <div className="w-full overflow-x-auto no-scrollbar py-2 px-4 flex items-center gap-2">
      {categories.map((cat) => {
        const isSelected = selectedCategory === cat;
        return (
          <button
            key={cat}
            onClick={() => onSelectCategory(cat)}
            className={clsx(
              'px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 active:scale-95',
              isSelected
                ? 'glass-pill-active scale-105'
                : 'glass-pill text-white/80 hover:text-white hover:bg-white/20'
            )}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
};
