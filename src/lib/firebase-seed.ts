import { adminDb } from './firebase-admin';
import bcrypt from 'bcryptjs';

export async function initializeFirebaseDatabase() {
  try {
    // 1. Seed Users if collection is empty
    const usersSnap = await adminDb.collection('users').limit(1).get();
    if (usersSnap.empty) {
      console.log('Seeding default users to Firestore...');
      const adminPasswordHash = await bcrypt.hash('admin123', 10);
      const staffPasswordHash = await bcrypt.hash('staff123', 10);
      const supervisorPasswordHash = await bcrypt.hash('supervisor123', 10);
      const securityPasswordHash = await bcrypt.hash('security123', 10);

      const users = [
        {
          id: '556e6c97-9b14-44e1-8a35-74719a343199',
          name: 'System Admin',
          email: 'admin@glasscutting.com',
          password_hash: adminPasswordHash,
          role: 'admin',
          status: 'active',
          created_at: new Date().toISOString(),
        },
        {
          id: '66cdcd42-10ad-4f5a-9c2b-0e8690a63519',
          name: 'John Staff',
          email: 'staff@glasscutting.com',
          password_hash: staffPasswordHash,
          role: 'user',
          status: 'active',
          created_at: new Date().toISOString(),
        },
        {
          id: 'ee983a60-bab1-4169-b8ca-e2d23fa15842',
          name: 'Supervisor User',
          email: 'supervisor@glasscutting.com',
          password_hash: supervisorPasswordHash,
          role: 'supervisor',
          status: 'active',
          created_at: new Date().toISOString(),
        },
        {
          id: '7cbe52fc-bd3a-4797-9f1e-3b86f8cce850',
          name: 'Officer Kwame',
          email: 'security@glasscutting.com',
          password_hash: securityPasswordHash,
          role: 'security',
          status: 'active',
          pin: '1234',
          created_at: new Date().toISOString(),
        }
      ];

      for (const u of users) {
        await adminDb.collection('users').doc(u.id).set(u);
      }
    }

    // 2. Seed Glass Types if empty
    const glassTypesSnap = await adminDb.collection('glass_types').limit(1).get();
    if (glassTypesSnap.empty) {
      console.log('Seeding default glass types to Firestore...');
      const glassTypes = [
        { id: 'clear-5mm', name: 'Clear Float (5mm)', price_per_sqm: 200.0, updated_at: new Date().toISOString() },
        { id: 'frosted-6mm', name: 'Frosted Glass (6mm)', price_per_sqm: 350.0, updated_at: new Date().toISOString() },
        { id: 'tinted-bronze-grey', name: 'Tinted Glass (Bronze/Grey)', price_per_sqm: 400.0, updated_at: new Date().toISOString() },
        { id: 'tempered-safety', name: 'Tempered Safety Glass', price_per_sqm: 500.0, updated_at: new Date().toISOString() },
        { id: 'laminated-double', name: 'Laminated Glass (Double)', price_per_sqm: 650.0, updated_at: new Date().toISOString() },
      ];

      for (const gt of glassTypes) {
        await adminDb.collection('glass_types').doc(gt.id).set(gt);
      }
    }

    // 3. Seed default Glazing Catalog if empty
    const categoriesSnap = await adminDb.collection('categories').limit(1).get();
    if (categoriesSnap.empty) {
      console.log('Seeding default glazing categories and subtypes to Firestore...');
      const defaultCatalog = [
        {
          id: 'windows',
          name: 'Window Systems',
          slug: 'window',
          created_at: new Date().toISOString(),
          subtypes: [
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
          created_at: new Date().toISOString(),
          subtypes: [
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
          created_at: new Date().toISOString(),
          subtypes: [
            { id: 'fixed_shower_screen', name: 'Fixed Walk-in Glass Screen', defaultWidth: 1000, defaultHeight: 2000, operationalType: 'fixed' },
            { id: 'inline_shower_door', name: 'Hinged Shower Door (Inline Setup)', defaultWidth: 1200, defaultHeight: 2000, operationalType: 'hinged' },
            { id: 'sliding_shower_enclosure', name: 'Sliding / Bypass Shower Enclosure', defaultWidth: 1500, defaultHeight: 2000, operationalType: 'sliding' },
            { id: 'corner_shower_enclosure', name: '90-Degree Corner Enclosure', defaultWidth: 1200, defaultHeight: 2000, operationalType: 'fixed' },
          ],
        },
      ];

      for (const cat of defaultCatalog) {
        await adminDb.collection('categories').doc(cat.id).set(cat);
      }
    }
  } catch (err) {
    console.error('Error during lazy seeding of Firebase Database:', err);
  }
}
