const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.candidateSkill.deleteMany();
  await prisma.candidateExperience.deleteMany();
  await prisma.candidateEducation.deleteMany();
  await prisma.candidateProject.deleteMany();
  await prisma.candidateTechnology.deleteMany();
  await prisma.matchResult.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.jobSkill.deleteMany();
  await prisma.job.deleteMany();
  await prisma.skill.deleteMany();
  console.log('✅ Cleaned existing data');

  // Create organization
  const org = await prisma.organization.upsert({
    where: { id: 'cmlbmr0520001ecb82yamw366' },
    create: {
      id: 'cmlbmr0520001ecb82yamw366',
      name: 'Tech Innovations Inc',
    },
    update: {},
  });
  console.log('✅ Organization created:', org.name);

  // Create user
  const user = await prisma.user.upsert({
    where: { id: 'user_39IG2D1Q6ApM1jvgKUaZCZgaVgu' },
    create: {
      id: 'user_39IG2D1Q6ApM1jvgKUaZCZgaVgu',
      email: 'ahmadkhan58012@gmail.com',
      name: 'Ahmad Khan',
    },
    update: {},
  });
  console.log('✅ User created:', user.name);

  // Create membership
  await prisma.membership.upsert({
    where: {
      userId_orgId: {
        userId: user.id,
        orgId: org.id,
      },
    },
    create: {
      userId: user.id,
      orgId: org.id,
      role: 'OWNER',
    },
    update: {},
  });
  console.log('✅ Membership created');

  // Create skills
  const skills = [
    'React', 'Node.js', 'Python', 'JavaScript', 'TypeScript',
    'AWS', 'Docker', 'Kubernetes', 'PostgreSQL', 'MongoDB',
    'Java', 'Spring', 'Angular', 'Vue.js', 'GraphQL'
  ];

  const skillRecords = [];
  for (const skillName of skills) {
    const skill = await prisma.skill.upsert({
      where: { orgId_name: { orgId: org.id, name: skillName } },
      create: { name: skillName, orgId: org.id },
      update: {},
    });
    skillRecords.push(skill);
  }
  console.log(`✅ ${skills.length} skills created`);

  // Create candidates
  const candidates = [
    {
      fullName: 'Sarah Johnson',
      email: 'sarah.johnson@email.com',
      phone: '555-0101',
      dateOfBirth: new Date('1992-05-15'),
      location: 'San Francisco, CA',
      currentTitle: 'Senior Full Stack Developer',
      yearsOfExperience: 7,
      linkedinUrl: 'https://linkedin.com/in/sarahjohnson',
      githubUrl: 'https://github.com/sarahjohnson',
      portfolioUrl: 'https://sarahjohnson.dev',
      status: 'ACTIVE',
      source: 'LINKEDIN',
      externalId: 'EXT-001',
      notes: 'Excellent full-stack developer with strong React and Node.js experience. Led multiple successful projects.',
      skills: ['React', 'Node.js', 'TypeScript', 'AWS', 'PostgreSQL'],
      experiences: [
        {
          company: 'Tech Innovations Inc',
          role: 'Senior Full Stack Developer',
          location: 'San Francisco, CA',
          startMonth: new Date('2021-03-01'),
          endMonth: null,
          isCurrent: true,
          bullets: [
            'Led development of microservices architecture serving 1M+ users',
            'Reduced API response time by 40% through optimization',
            'Mentored 5 junior developers and conducted code reviews',
            'Implemented CI/CD pipeline reducing deployment time by 60%'
          ]
        },
        {
          company: 'StartupXYZ',
          role: 'Full Stack Developer',
          location: 'San Francisco, CA',
          startMonth: new Date('2018-06-01'),
          endMonth: new Date('2021-02-28'),
          isCurrent: false,
          bullets: [
            'Built real-time chat application using WebSockets and React',
            'Developed RESTful APIs with Node.js and Express',
            'Integrated payment processing with Stripe API',
            'Collaborated with design team on UI/UX improvements'
          ]
        }
      ],
      educations: [
        {
          school: 'Stanford University',
          degree: 'Bachelor of Science in Computer Science',
          location: 'Stanford, CA',
          startYear: 2014,
          endYear: 2018
        }
      ],
      projects: [
        {
          title: 'E-commerce Platform',
          dates: '2023 - Present',
          techStack: 'React, Node.js, PostgreSQL, AWS',
          link: 'https://github.com/sarahjohnson/ecommerce',
          bullets: [
            'Built scalable e-commerce platform handling 10K+ daily transactions',
            'Implemented real-time inventory management system',
            'Integrated multiple payment gateways (Stripe, PayPal)'
          ]
        },
        {
          title: 'Task Management App',
          dates: '2022',
          techStack: 'React, Firebase, Material-UI',
          link: 'https://taskmanager.sarahjohnson.dev',
          bullets: [
            'Developed collaborative task management tool',
            'Implemented real-time updates using Firebase',
            'Achieved 95% user satisfaction rating'
          ]
        }
      ],
      technologies: [
        { category: 'Languages', items: ['JavaScript', 'TypeScript', 'Python', 'SQL'] },
        { category: 'Frontend', items: ['React', 'Next.js', 'Vue.js', 'Tailwind CSS'] },
        { category: 'Backend', items: ['Node.js', 'Express', 'NestJS', 'GraphQL'] },
        { category: 'Database', items: ['PostgreSQL', 'MongoDB', 'Redis'] },
        { category: 'Cloud & DevOps', items: ['AWS', 'Docker', 'Kubernetes', 'CI/CD'] }
      ]
    },
    {
      fullName: 'Michael Chen',
      email: 'michael.chen@email.com',
      phone: '555-0102',
      dateOfBirth: new Date('1988-11-20'),
      location: 'New York, NY',
      currentTitle: 'DevOps Engineer',
      yearsOfExperience: 9,
      linkedinUrl: 'https://linkedin.com/in/michaelchen',
      githubUrl: 'https://github.com/michaelchen',
      portfolioUrl: 'https://michaelchen.io',
      status: 'ACTIVE',
      source: 'REFERRAL',
      externalId: 'EXT-002',
      notes: 'Expert DevOps engineer with extensive Kubernetes and AWS experience. Strong automation and infrastructure skills.',
      skills: ['Docker', 'Kubernetes', 'AWS', 'Python', 'PostgreSQL'],
      experiences: [
        {
          company: 'CloudScale Solutions',
          role: 'Senior DevOps Engineer',
          location: 'New York, NY',
          startMonth: new Date('2020-01-01'),
          endMonth: null,
          isCurrent: true,
          bullets: [
            'Architected and deployed Kubernetes clusters serving 500+ microservices',
            'Reduced infrastructure costs by 35% through resource optimization',
            'Implemented GitOps workflow with ArgoCD and Flux',
            'Built monitoring stack with Prometheus, Grafana, and ELK'
          ]
        },
        {
          company: 'FinTech Corp',
          role: 'DevOps Engineer',
          location: 'New York, NY',
          startMonth: new Date('2016-08-01'),
          endMonth: new Date('2019-12-31'),
          isCurrent: false,
          bullets: [
            'Automated deployment pipeline reducing release time from 4 hours to 15 minutes',
            'Managed AWS infrastructure (EC2, RDS, S3, Lambda)',
            'Implemented disaster recovery plan with 99.99% uptime SLA',
            'Led migration from monolith to microservices architecture'
          ]
        }
      ],
      educations: [
        {
          school: 'MIT',
          degree: 'Master of Science in Computer Science',
          location: 'Cambridge, MA',
          startYear: 2013,
          endYear: 2015
        },
        {
          school: 'UC Berkeley',
          degree: 'Bachelor of Science in Electrical Engineering',
          location: 'Berkeley, CA',
          startYear: 2009,
          endYear: 2013
        }
      ],
      projects: [
        {
          title: 'Infrastructure as Code Framework',
          dates: '2023',
          techStack: 'Terraform, AWS, Python, GitHub Actions',
          link: 'https://github.com/michaelchen/iac-framework',
          bullets: [
            'Built reusable Terraform modules for AWS infrastructure',
            'Automated provisioning of complete environments in under 10 minutes',
            'Open-sourced framework with 500+ GitHub stars'
          ]
        },
        {
          title: 'Kubernetes Monitoring Dashboard',
          dates: '2022',
          techStack: 'Go, Kubernetes, Prometheus, React',
          link: 'https://k8s-monitor.michaelchen.io',
          bullets: [
            'Developed custom Kubernetes monitoring solution',
            'Real-time cluster health visualization',
            'Automated alerting for resource anomalies'
          ]
        }
      ],
      technologies: [
        { category: 'Cloud Platforms', items: ['AWS', 'GCP', 'Azure'] },
        { category: 'Containers & Orchestration', items: ['Docker', 'Kubernetes', 'Helm', 'ArgoCD'] },
        { category: 'Infrastructure as Code', items: ['Terraform', 'CloudFormation', 'Ansible'] },
        { category: 'CI/CD', items: ['Jenkins', 'GitHub Actions', 'GitLab CI', 'CircleCI'] },
        { category: 'Monitoring & Logging', items: ['Prometheus', 'Grafana', 'ELK Stack', 'Datadog'] },
        { category: 'Programming', items: ['Python', 'Go', 'Bash', 'JavaScript'] }
      ]
    },
    {
      fullName: 'Emily Rodriguez',
      email: 'emily.rodriguez@email.com',
      phone: '555-0103',
      dateOfBirth: new Date('1995-03-08'),
      location: 'Austin, TX',
      currentTitle: 'Frontend Developer',
      yearsOfExperience: 4,
      linkedinUrl: 'https://linkedin.com/in/emilyrodriguez',
      portfolioUrl: 'https://emilyrodriguez.dev',
      status: 'ACTIVE',
      source: 'CAREER_SITE',
      externalId: 'EXT-003',
      skills: ['React', 'TypeScript', 'Vue.js', 'GraphQL'],
    },
    {
      fullName: 'David Kim',
      email: 'david.kim@email.com',
      phone: '555-0104',
      dateOfBirth: new Date('1990-07-25'),
      location: 'Seattle, WA',
      currentTitle: 'Backend Engineer',
      yearsOfExperience: 6,
      linkedinUrl: 'https://linkedin.com/in/davidkim',
      githubUrl: 'https://github.com/davidkim',
      status: 'ACTIVE',
      source: 'AGENCY',
      externalId: 'EXT-004',
      skills: ['Java', 'Spring', 'PostgreSQL', 'MongoDB', 'AWS'],
    },
    {
      fullName: 'Jessica Martinez',
      email: 'jessica.martinez@email.com',
      phone: '555-0105',
      dateOfBirth: new Date('1993-09-12'),
      location: 'Boston, MA',
      currentTitle: 'Full Stack Developer',
      yearsOfExperience: 5,
      linkedinUrl: 'https://linkedin.com/in/jessicamartinez',
      status: 'ACTIVE',
      source: 'JOB_BOARD',
      externalId: 'EXT-005',
      skills: ['Python', 'JavaScript', 'React', 'Node.js', 'MongoDB'],
    },
  ];

  for (const candidateData of candidates) {
    const { skills: candidateSkills, experiences, educations, projects, technologies, notes, ...candidateInfo } = candidateData;
    
    const candidate = await prisma.candidate.create({
      data: {
        ...candidateInfo,
        notes: notes || null,
        orgId: org.id,
        createdBy: user.id,
      },
    });

    // Add skills
    for (const skillName of candidateSkills) {
      const skill = skillRecords.find(s => s.name === skillName);
      if (skill) {
        await prisma.candidateSkill.create({
          data: {
            candidateId: candidate.id,
            skillId: skill.id,
            source: 'manual',
          },
        });
      }
    }

    // Add experiences
    if (experiences) {
      for (const exp of experiences) {
        await prisma.candidateExperience.create({
          data: {
            candidateId: candidate.id,
            ...exp,
          },
        });
      }
    }

    // Add educations
    if (educations) {
      for (const edu of educations) {
        await prisma.candidateEducation.create({
          data: {
            candidateId: candidate.id,
            ...edu,
          },
        });
      }
    }

    // Add projects
    if (projects) {
      for (const project of projects) {
        await prisma.candidateProject.create({
          data: {
            candidateId: candidate.id,
            ...project,
          },
        });
      }
    }

    // Add technologies
    if (technologies) {
      for (const tech of technologies) {
        await prisma.candidateTechnology.create({
          data: {
            candidateId: candidate.id,
            ...tech,
          },
        });
      }
    }

    console.log(`✅ Candidate created: ${candidate.fullName}`);
  }

  // Create jobs
  const jobs = [
    {
      title: 'Senior React Developer',
      description: 'We are looking for an experienced React developer to join our frontend team.',
      location: 'San Francisco, CA',
      status: 'OPEN',
      skills: [
        { name: 'React', weight: 5 },
        { name: 'TypeScript', weight: 4 },
        { name: 'Node.js', weight: 3 },
        { name: 'GraphQL', weight: 3 },
      ],
    },
    {
      title: 'DevOps Engineer',
      description: 'Join our infrastructure team to build and maintain our cloud infrastructure.',
      location: 'Remote',
      status: 'OPEN',
      skills: [
        { name: 'Docker', weight: 5 },
        { name: 'Kubernetes', weight: 5 },
        { name: 'AWS', weight: 4 },
        { name: 'Python', weight: 3 },
      ],
    },
    {
      title: 'Full Stack Engineer',
      description: 'Work on both frontend and backend of our core product.',
      location: 'New York, NY',
      status: 'OPEN',
      skills: [
        { name: 'React', weight: 4 },
        { name: 'Node.js', weight: 4 },
        { name: 'PostgreSQL', weight: 4 },
        { name: 'TypeScript', weight: 3 },
      ],
    },
    {
      title: 'Backend Java Developer',
      description: 'Build scalable microservices using Java and Spring.',
      location: 'Austin, TX',
      status: 'OPEN',
      skills: [
        { name: 'Java', weight: 5 },
        { name: 'Spring', weight: 5 },
        { name: 'PostgreSQL', weight: 4 },
        { name: 'AWS', weight: 3 },
      ],
    },
  ];

  for (const jobData of jobs) {
    const { skills: jobSkills, ...jobInfo } = jobData;
    
    const job = await prisma.job.create({
      data: {
        ...jobInfo,
        orgId: org.id,
      },
    });

    // Add skills
    for (const { name: skillName, weight } of jobSkills) {
      const skill = skillRecords.find(s => s.name === skillName);
      if (skill) {
        await prisma.jobSkill.create({
          data: {
            jobId: job.id,
            skillId: skill.id,
            weight,
          },
        });
      }
    }

    console.log(`✅ Job created: ${job.title}`);
  }

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
