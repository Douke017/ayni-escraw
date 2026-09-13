// SPDX-License-Identifier: MIT

export type HardwareCategory = 'SMARTPHONE' | 'LAPTOP' | 'COMPONENT' | 'CONSOLES';

export interface CategoryMetadata {
  key: HardwareCategory;
  label: string;
  aguayoColorToken: string;
  icon: string;
  description: string;
}

export const HARDWARE_CATEGORIES: CategoryMetadata[] = [
  {
    key: 'SMARTPHONE',
    label: 'Smartphones y Celulares',
    aguayoColorToken: 'var(--aguayo-burgundy)',
    icon: '📱',
    description: 'iPhone, Samsung Galaxy, Pixel desbloqueados y con IMEI verificado',
  },
  {
    key: 'LAPTOP',
    label: 'Laptops y MacBooks',
    aguayoColorToken: 'var(--aguayo-olive)',
    icon: '💻',
    description: 'Portátiles de alto rendimiento, ciclos de batería y memorias revisadas',
  },
  {
    key: 'COMPONENT',
    label: 'GPUs y Componentes PC',
    aguayoColorToken: 'var(--aguayo-indigo)',
    icon: '⚡',
    description: 'Tarjetas gráficas, procesadores y placas base sin desgaste de minería',
  },
  {
    key: 'CONSOLES',
    label: 'Consolas y Accesorios',
    aguayoColorToken: 'var(--aguayo-gold)',
    icon: '🎮',
    description: 'PlayStation, Nintendo Switch, Xbox con sellos de garantía intactos',
  },
];
