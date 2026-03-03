import { NextResponse } from 'next/server';
import { createRoute } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import JSZip from 'jszip';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';

export const GET = createRoute(
  {
    requireAuth: true,
    requireOrg: true,
    permission: 'candidates:read',
  },
  async (req, { orgId }) => {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'csv';
    const ids = searchParams.get('ids') || undefined;

    if (format === 'csv') {
      return exportCSV(orgId!);
    } else if (format === 'zip') {
      return exportZIP(orgId!, ids);
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  }
);

async function exportCSV(orgId: string) {
  const candidates = await prisma.candidate.findMany({
    where: { orgId },
    include: {
      skills: {
        include: { skill: true },
      },
      experiences: {
        orderBy: { startMonth: 'desc' },
      },
      educations: {
        orderBy: { endYear: 'desc' },
      },
      projects: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // CSV Headers
  const headers = [
    'Full Name',
    'Email',
    'Phone',
    'Location',
    'Current Title',
    'Years of Experience',
    'Status',
    'Source',
    'LinkedIn',
    'GitHub',
    'Portfolio',
    'Skills',
    'Latest Company',
    'Latest Role',
    'Education',
    'Date of Birth',
    'External ID',
    'Created At',
  ];

  // CSV Rows
  const rows = candidates.map((c) => {
    const skills = c.skills.map((s) => s.skill.name).join('; ');
    const latestExp = c.experiences[0];
    const latestEdu = c.educations[0];

    return [
      c.fullName,
      c.email || '',
      c.phone || '',
      c.location || '',
      c.currentTitle || '',
      c.yearsOfExperience?.toString() || '',
      c.status || '',
      c.source || '',
      c.linkedinUrl || '',
      c.githubUrl || '',
      c.portfolioUrl || '',
      skills,
      latestExp?.company || '',
      latestExp?.role || '',
      latestEdu ? `${latestEdu.degree || ''} - ${latestEdu.school}` : '',
      c.dateOfBirth?.toISOString().split('T')[0] || '',
      c.externalId || '',
      c.createdAt.toISOString().split('T')[0],
    ];
  });

  // Build CSV
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="candidates-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}

async function exportZIP(orgId: string, ids?: string) {
  const where: any = { orgId };
  
  if (ids) {
    const candidateIds = ids.split(',').filter(Boolean);
    if (candidateIds.length > 0) {
      where.id = { in: candidateIds };
    }
  }

  const candidates = await prisma.candidate.findMany({
    where,
    include: {
      skills: { include: { skill: true } },
      experiences: { orderBy: { startMonth: 'desc' } },
      educations: { orderBy: { endYear: 'desc' } },
      projects: true,
    },
  });

  if (candidates.length === 0) {
    return NextResponse.json(
      { error: 'No candidates available to export' },
      { status: 404 }
    );
  }

  const zip = new JSZip();

  for (const candidate of candidates) {
    const contactParts = [];
    if (candidate.email) contactParts.push(candidate.email);
    if (candidate.phone) contactParts.push(candidate.phone);

    const linkParts = [];
    if (candidate.linkedinUrl) linkParts.push(candidate.linkedinUrl);
    if (candidate.githubUrl) linkParts.push(candidate.githubUrl);
    if (candidate.portfolioUrl) linkParts.push(candidate.portfolioUrl);

    const doc = new Document({
      sections: [
        {
          children: [
            // Name
            new Paragraph({
              text: candidate.fullName,
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              style: 'Heading1',
            }),

            // Contact Info
            ...(contactParts.length > 0
              ? [
                  new Paragraph({
                    text: contactParts.join(' | '),
                    alignment: AlignmentType.CENTER,
                    spacing: { after: linkParts.length > 0 ? 100 : 300 },
                  }),
                ]
              : []),

            // Links
            ...(linkParts.length > 0
              ? [
                  new Paragraph({
                    text: linkParts.join(' | '),
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 300 },
                  }),
                ]
              : []),

            // Skills
            ...(candidate.skills.length > 0
              ? [
                  new Paragraph({
                    text: 'SKILLS',
                    spacing: { before: 200, after: 100 },
                    style: 'Heading2',
                  }),
                  new Paragraph({
                    text: candidate.skills.map((s) => s.skill.name).join(', '),
                    spacing: { after: 300 },
                  }),
                ]
              : []),

            // Experience
            ...(candidate.experiences.length > 0
              ? [
                  new Paragraph({
                    text: 'EXPERIENCE',
                    spacing: { before: 200, after: 100 },
                    style: 'Heading2',
                  }),
                  ...candidate.experiences.flatMap((exp) => [
                    new Paragraph({
                      children: [
                        new TextRun({ text: exp.role, bold: true }),
                        new TextRun({ text: ' | ' + exp.company }),
                      ],
                      spacing: { after: 50 },
                    }),
                    new Paragraph({
                      text: `${exp.startMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${exp.endMonth ? exp.endMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Present'}${exp.location ? ' | ' + exp.location : ''}`,
                      spacing: { after: 100 },
                    }),
                    ...exp.bullets.map(
                      (bullet) =>
                        new Paragraph({
                          text: '• ' + bullet,
                          spacing: { after: 50 },
                        })
                    ),
                    new Paragraph({ text: '', spacing: { after: 200 } }),
                  ]),
                ]
              : []),

            // Education
            ...(candidate.educations.length > 0
              ? [
                  new Paragraph({
                    text: 'EDUCATION',
                    spacing: { before: 200, after: 100 },
                    style: 'Heading2',
                  }),
                  ...candidate.educations.flatMap((edu) => [
                    new Paragraph({
                      children: [
                        new TextRun({ text: edu.school, bold: true }),
                        ...(edu.degree ? [new TextRun({ text: ' | ' + edu.degree })] : []),
                      ],
                      spacing: { after: 50 },
                    }),
                    new Paragraph({
                      text: `${edu.startYear || ''} - ${edu.endYear || ''}${edu.location ? ' | ' + edu.location : ''}`,
                      spacing: { after: 200 },
                    }),
                  ]),
                ]
              : []),

            // Projects
            ...(candidate.projects.length > 0
              ? [
                  new Paragraph({
                    text: 'PROJECTS',
                    spacing: { before: 200, after: 100 },
                    style: 'Heading2',
                  }),
                  ...candidate.projects.flatMap((proj) => [
                    new Paragraph({
                      children: [
                        new TextRun({ text: proj.title, bold: true }),
                        ...(proj.dates ? [new TextRun({ text: ' | ' + proj.dates })] : []),
                      ],
                      spacing: { after: 50 },
                    }),
                    ...(proj.techStack
                      ? [
                          new Paragraph({
                            text: 'Tech: ' + proj.techStack,
                            spacing: { after: 50 },
                          }),
                        ]
                      : []),
                    ...(proj.link
                      ? [
                          new Paragraph({
                            text: proj.link,
                            spacing: { after: 50 },
                          }),
                        ]
                      : []),
                    ...proj.bullets.map(
                      (bullet) =>
                        new Paragraph({
                          text: '• ' + bullet,
                          spacing: { after: 50 },
                        })
                    ),
                    new Paragraph({ text: '', spacing: { after: 200 } }),
                  ]),
                ]
              : []),
          ],
        },
      ],
      styles: {
        paragraphStyles: [
          {
            id: 'Heading1',
            name: 'Heading 1',
            basedOn: 'Normal',
            next: 'Normal',
            run: {
              size: 28,
              bold: true,
              color: '000000',
            },
          },
          {
            id: 'Heading2',
            name: 'Heading 2',
            basedOn: 'Normal',
            next: 'Normal',
            run: {
              size: 28,
              bold: true,
              color: '000000',
            },
          },
          {
            id: 'Normal',
            name: 'Normal',
            run: {
              size: 22,
              color: '000000',
            },
          },
        ],
      },
    });

    const buffer = await Packer.toBuffer(doc);
    const fileName = candidate.fullName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_') + '_Resume.docx';
    zip.file(fileName, buffer);
  }

  const zipBlob = await zip.generateAsync({ type: 'nodebuffer' });
  const zipBytes = new Uint8Array(zipBlob);

  return new NextResponse(zipBytes, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="resumes-${new Date().toISOString().split('T')[0]}.zip"`,
    },
  });
}
