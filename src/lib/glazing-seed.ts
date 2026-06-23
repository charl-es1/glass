import prisma from './db';

export const DEFAULT_CATALOG = [
  {
    id: 'windows',
    name: 'Window Systems',
    slug: 'window',
    types: [
      { id: 'casement_window', name: 'Casement Window', defaultWidth: 800, defaultHeight: 1200, operationalType: 'hinged' },
      { id: 'awning_window', name: 'Projected / Awning Window', defaultWidth: 1000, defaultHeight: 800, operationalType: 'awning' },
      { id: 'tilt_turn_window', name: 'Tilt and Turn Window', defaultWidth: 900, defaultHeight: 1300, operationalType: 'hinged' },
      { id: 'fanlight_window', name: 'Fanlight Window (Fixed)', defaultWidth: 1200, defaultHeight: 600, operationalType: 'fixed' },
      { id: 'sliding_window', name: 'Sliding Window', defaultWidth: 1500, defaultHeight: 1200, operationalType: 'sliding' },
      { id: 'double_casement_window', name: '2-Opening Casement Window', defaultWidth: 1600, defaultHeight: 1200, operationalType: 'hinged' },
    ],
  },
  {
    id: 'doors',
    name: 'Door Systems',
    slug: 'door',
    types: [
      { id: 'single_hinged_door', name: 'Single Hinged Entry Door', defaultWidth: 900, defaultHeight: 2100, operationalType: 'hinged' },
      { id: 'double_french_door', name: 'Double French Door', defaultWidth: 1800, defaultHeight: 2100, operationalType: 'hinged' },
      { id: 'sliding_patio_door', name: 'Sliding Patio Door (Double Slider)', defaultWidth: 3300, defaultHeight: 2790, operationalType: 'sliding' },
      { id: 'door_sidelite', name: 'Hinged Door with Fixed Sidelite', defaultWidth: 1350, defaultHeight: 2200, operationalType: 'hinged' },
      { id: 'bifold_door', name: 'Bi-Folding Door System', defaultWidth: 3000, defaultHeight: 2400, operationalType: 'sliding' },
    ],
  },
  {
    id: 'showers',
    name: 'Bathroom & Shower Glass',
    slug: 'shower',
    types: [
      { id: 'fixed_shower_screen', name: 'Fixed Walk-in Glass Screen', defaultWidth: 1000, defaultHeight: 2000, operationalType: 'fixed' },
      { id: 'inline_shower_door', name: 'Hinged Shower Door (Inline Setup)', defaultWidth: 1200, defaultHeight: 2000, operationalType: 'hinged' },
      { id: 'sliding_shower_enclosure', name: 'Sliding / Bypass Shower Enclosure', defaultWidth: 1500, defaultHeight: 2000, operationalType: 'sliding' },
      { id: 'corner_shower_enclosure', name: '90-Degree Corner Enclosure', defaultWidth: 1200, defaultHeight: 2000, operationalType: 'fixed' },
    ],
  },
];

export async function initializeGlazingCatalog() {
  try {
    const count = await prisma.category.count();
    if (count > 0) return;

    console.log('Lazy seeding glazing configuration catalog...');
    for (const cat of DEFAULT_CATALOG) {
      const createdCat = await prisma.category.create({
        data: {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
        },
      });

      for (const t of cat.types) {
        await prisma.subType.create({
          data: {
            id: t.id,
            categoryId: createdCat.id,
            name: t.name,
            slug: t.id,
            defaultWidth: t.defaultWidth,
            defaultHeight: t.defaultHeight,
            operationalType: t.operationalType,
          },
        });
      }
    }
    console.log('Glazing catalog initialized successfully.');
  } catch (error) {
    console.error('Error initializing glazing catalog:', error);
  }
}
