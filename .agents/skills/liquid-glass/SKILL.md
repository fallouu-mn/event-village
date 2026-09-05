---
name: liquid-glass
description: "Apple-style Liquid Glass effect (refraction, chromatic aberration, frosted glass, elastic physics, edge light reflection) for React/Next.js using liquid-glass-react. Use when creating tactile, luxury, or Apple VisionOS / macOS Sequoia style glassmorphic components (cards, buttons, modals, floating docks, navbars)."
---

# Liquid Glass React Skill

Use this skill when designing and building **Apple Liquid Glass** components in React / Next.js.
Powered by `liquid-glass-react` (WebGL & SVG shader refraction displacement maps).

## Key Capabilities

- **Refraction & Displacement**: Light bending through thick glass edges based on background.
- **Chromatic Aberration**: Realistic RGB color splitting on the corners.
- **Dynamic Frosting**: Configurable blur and saturation enhancement.
- **Elastic Physics**: Responds elastically to mouse movement and clicks.
- **Edge Highlights**: Borders capture ambient lighting dynamically.

---

## 1. Quick Installation

```bash
npm install liquid-glass-react --legacy-peer-deps
```

---

## 2. Component Usage Patterns

### A. Basic Glass Card (Next.js Client Component)

```tsx
'use client';

import React from 'react';
import LiquidGlass from 'liquid-glass-react';

export function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <LiquidGlass
      displacementScale={60}
      blurAmount={0.12}
      saturation={125}
      aberrationIntensity={1.8}
      elasticity={0.3}
      cornerRadius={24}
      padding="24px"
      className="shadow-2xl border border-white/20"
    >
      {children}
    </LiquidGlass>
  );
}
```

### B. Tactile Pill Button

```tsx
'use client';

import React from 'react';
import LiquidGlass from 'liquid-glass-react';

export function LiquidButton({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <LiquidGlass
      displacementScale={64}
      blurAmount={0.08}
      saturation={135}
      aberrationIntensity={2}
      elasticity={0.4}
      cornerRadius={9999}
      padding="10px 24px"
      onClick={onClick}
      className="cursor-pointer active:scale-95 transition-transform select-none"
    >
      <span className="text-sm font-bold text-white tracking-wide drop-shadow-sm">
        {label}
      </span>
    </LiquidGlass>
  );
}
```

### C. Floating Navbar / Dock with Mouse Tracking

```tsx
'use client';

import React, { useRef } from 'react';
import LiquidGlass from 'liquid-glass-react';

export function GlassFloatingDock() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="relative w-full">
      <LiquidGlass
        mouseContainer={containerRef}
        displacementScale={75}
        blurAmount={0.15}
        elasticity={0.35}
        cornerRadius={32}
        padding="12px 28px"
        className="mx-auto flex items-center gap-6 shadow-2xl"
      >
        <nav className="flex items-center gap-6 text-sm font-semibold text-white/90">
          <a href="#events" className="hover:text-white transition-colors">Événements</a>
          <a href="#tables" className="hover:text-white transition-colors">Tables</a>
          <a href="#halls" className="hover:text-white transition-colors">Salles</a>
        </nav>
      </LiquidGlass>
    </div>
  );
}
```

---

## 3. Reference Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `displacementScale` | `number` | `70` | Intensity of the glass refraction distortion. |
| `blurAmount` | `number` | `0.1` | Frostiness / background blur level. |
| `saturation` | `number` | `130` | Color boost of background through glass (100 = normal). |
| `aberrationIntensity`| `number`| `2` | RGB chromatic aberration strength on edges. |
| `elasticity` | `number` | `0.35`| Physics elasticity on hover/motion (0 = stiff, 1 = jelly).|
| `cornerRadius` | `number` | `16` | Border radius in pixels. |
| `padding` | `string` | `"16px"`| Internal padding inside glass container. |
| `mouseContainer` | `Ref` | `null` | Parent ref to track mouse coordinates over a larger zone. |

---

## 4. Best Practices

1. **Always use `'use client'`** in Next.js since WebGL / Canvas / DOM event listeners run on client.
2. **Background Matters**: Liquid glass is most stunning over vibrant images, gradients, mesh backgrounds, or animated canvas.
3. **Graceful Fallbacks**: Combine with Tailwind `backdrop-blur-xl bg-white/10` for browsers without full displacement map support (Safari/Firefox).
