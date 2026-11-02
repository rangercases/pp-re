/**
 * Shared test fixtures for FASREP automated test suite.
 */

export const TEST_USERS = {
  admin: {
    email: 'admin.qa@sofacompany.com',
    name: 'Senior QA Admin',
    password: 'AdminPassword123!',
    role: 'admin',
  },
  engineer1: {
    email: 'nhan.hoang@sofacompany.com',
    name: 'Nhan Hoang',
    password: 'EngineerPass123!',
    role: 'user',
  },
  engineer2: {
    email: 'quoc.hung@sofacompany.com',
    name: 'Quoc Hung',
    password: 'EngineerPass456!',
    role: 'user',
  },
};

export const UNICODE_VIETNAMESE_SAMPLES = {
  title: 'BÁO CÁO ĐÁNH GIÁ MẪU THỬ SẢN PHẨM (PROTOTYPE SAMPLE REVIEW)',
  productName: 'Bàn Trà Tròn Ricardo D1000 Gỗ Sồi Tự Nhiên',
  factory: 'Công Ty TNHH Sản Xuất Nội Thất Thịnh Phú - Bình Dương',
  defectNote: 'Độ lệch màu nhẹ giữa chân trước và chân sau. Cạnh vát đáy cần được chà nhám mịn hơn trước khi sơn PU hoàn thiện.',
  verdictCondition: 'Đồng ý duyệt mẫu có điều kiện: Yêu cầu nhà máy phân loại màu chân gỗ và xử lý cạnh vát cho lô sản xuất thử nghiệm.',
  specialChars: '<script>alert("xss")</script> & " \' < > 🛋️ 🪵 📐 📏 ✅ ⚠️ ❌',
};

/**
 * Creates an authentic SOFACOMPANY Prototype Review Report fixture (8 modules).
 * Based on MD 2756 Ricardo Side/Coffee Table.
 */
export function createPrototypeReportFixture(overrides = {}) {
  const timestamp = Date.now();
  const id = overrides.id || String(timestamp);

  return {
    id,
    moduleType: 'prototype',
    reportTitle: 'PROTOTYPE SAMPLE REVIEW REPORT',
    productName: 'Ricardo Coffee Table D1000',
    modelNumber: 'MD 2756',
    poNumber: 'PO-VN-2026-9812',
    factory: 'SOFACOMPANY VN (Thinh Phu Co., Ltd)',
    reviewer: 'Nhan Hoang',
    date: '22-Sep-26',
    verdict: 'APPROVED',
    revision: 1,

    // Module 1: Overview
    overview: {
      mdNumber: 'MD 2756',
      modelName: 'Ricardo Coffee Table D1000',
      factory: 'SOFACOMPANY VN (Thinh Phu Co., Ltd)',
      reviewer: 'Nhan Hoang',
      reviewDate: '22-Sep-26',
      sampleStage: 'Initial Prototype',
      status: 'Approved with Conditions',
    },

    // Module 2: Product Photos (Cover photos + gallery)
    coverPhotos: {
      FRONT_VIEW: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...',
      SIDE_VIEW: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...',
      TOP_VIEW: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...',
      DETAILS: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...',
    },
    prodPhotos: [
      { id: 'p1', caption: 'Tabletop solid oak grain pattern', url: 'data:image/jpeg;base64,mock1' },
      { id: 'p2', caption: 'Leg joint assembly underside', url: 'data:image/jpeg;base64,mock2' },
    ],

    // Module 3: Product Dimensions (unit-aware)
    dimensions: [
      { item: 'Diameter (Outer)', unit: 'mm', drawing: '1000', actual: '998', tolerance: '±5', status: 'PASS' },
      { item: 'Height (Total)', unit: 'mm', drawing: '450', actual: '451', tolerance: '±3', status: 'PASS' },
      { item: 'Tabletop Thickness', unit: 'mm', drawing: '25', actual: '24.8', tolerance: '±1', status: 'PASS' },
      { item: 'Leg Width', unit: 'mm', drawing: '60', actual: '60.2', tolerance: '±1', status: 'PASS' },
      { item: 'Total Weight', unit: 'kg', drawing: '18.5', actual: '18.3', tolerance: '±0.5', status: 'PASS' },
    ],

    // Module 4: Product Assembly
    assembly: {
      hardwareIncluded: true,
      boltType: 'M8 x 40mm Hex Screws (4 pcs)',
      toolProvided: 'M8 Allen Key',
      easeOfAssembly: 'Simple (1 person, <10 minutes)',
      notes: 'Leg alignment pins fit smoothly into pre-drilled tabletop dowel holes.',
    },
    assemblyPhotos: [
      { id: 'a1', caption: 'Hardware pack verification', url: 'data:image/jpeg;base64,mockA1' },
    ],

    // Module 5: Quality Watch Out (Defects & Callouts)
    watchout: [
      {
        defectId: 'W1',
        title: 'Color shade variation on rear leg',
        severity: 'Minor',
        description: 'Slight tone disparity between leg #3 and tabletop edge. Sanding chamfer needs fine grit 320 polish.',
        correctiveAction: 'Factory to implement strict wood batch color sorting prior to finish coating.',
      },
    ],
    watchoutPhotos: [
      { id: 'w1', caption: 'Rear leg shade macro view', url: 'data:image/jpeg;base64,mockW1' },
    ],

    // Module 6: Testing
    testing: {
      stabilityTest: 'PASS (No wobble under 50kg center load)',
      dropTestPackaging: 'PASS (Carton survived 10-point ISTA 1A drop test)',
      moistureContent: '10.2% (Standard 8-12% compliant)',
      finishAdhesion: 'Cross-hatch tape test: Grade 4B (Compliant)',
    },
    testingPhotos: [
      { id: 't1', caption: 'Moisture meter reading display', url: 'data:image/jpeg;base64,mockT1' },
    ],

    // Module 7: Quality Checklist
    checklist: [
      { task: 'Master drawing dimension audit', status: 'OK', notes: 'All dimensions within allowed tolerance' },
      { task: 'Packaging label & FSC barcode check', status: 'OK', notes: 'Correct FSC-C181124 label applied' },
      { task: 'Assembly instruction sheet included', status: 'OK', notes: 'IKEA-style clean outline booklet present' },
      { task: 'Hardware blister pack sealed', status: 'OK', notes: 'All 4 bolts and allen key sealed' },
      { task: 'Surface finish & lacquer smoothness', status: 'NOT OK', notes: 'Minor rough spot on chamfer edge' },
    ],
    checks: {
      rating: {
        'Approved': true,
        'Repair': false,
        'New Sample': false,
        'To send for final approval': false,
      },
    },

    // Module 8: Technical Documents
    docAttachments: [
      { fileName: 'MD_2756_Technical_Drawing_RevB.pdf', size: '1.4 MB' },
    ],

    thumbSmall: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP96px_thumb...',
    photoCount: 8,
    createdAt: new Date(timestamp).toISOString(),
    updatedAt: new Date(timestamp).toISOString(),
    ...overrides,
  };
}

/**
 * Creates an authentic SOFACOMPANY Pre-production Report fixture (10 modules).
 */
export function createPreProdReportFixture(overrides = {}) {
  const base = createPrototypeReportFixture({
    moduleType: 'pre-production',
    reportTitle: 'PRE-PRODUCTION SAMPLE REVIEW REPORT',
    ...overrides,
  });

  return {
    ...base,
    // Pre-prod Module 9: Product Comparison
    comparisonPhotos: [
      { id: 'c1', caption: 'Golden sample vs Pilot production unit', url: 'data:image/jpeg;base64,mockComp' },
    ],
    // Pre-prod Module 10: Final Approved / Green Label
    greenlabelPhotos: [
      { id: 'g1', caption: 'Signed Green Label tag on inner rail', url: 'data:image/jpeg;base64,mockGreen' },
    ],
    ...overrides,
  };
}

/**
 * Creates a large payload with repeated base64 blocks to test 500KB+ chunking.
 */
export function createLargePayloadFixture(approxSizeBytes = 1200000, overrides = {}) {
  const base = createPrototypeReportFixture(overrides);
  const chunkText = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz+/'.repeat(500); // ~32KB block
  const repeatCount = Math.ceil(approxSizeBytes / chunkText.length);

  const largePhotos = [];
  for (let i = 0; i < repeatCount; i++) {
    largePhotos.push({
      id: `large_photo_${i}`,
      caption: `High resolution inspection photo block ${i}`,
      data: `data:image/jpeg;base64,${chunkText}`,
    });
  }

  return {
    ...base,
    prodPhotos: largePhotos,
  };
}
