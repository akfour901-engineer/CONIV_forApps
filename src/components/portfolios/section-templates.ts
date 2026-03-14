
'use client';

export interface SectionTemplate {
  name: string;
  description: string;
  html: string;
}

// This file contains the default HTML templates for portfolio sections.
export const sectionTemplates: SectionTemplate[] = [
    {
      name: "Header Bar",
      description: "A sticky navigation header with links.",
      html: `
<header id="header" data-section-title="Header Bar" class="sticky top-0 z-50 bg-white/80 backdrop-blur-sm shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
            <div class="flex-shrink-0">
                <a href="#" class="text-2xl font-bold text-gray-800" data-editable="true">MyLogo</a>
            </div>
            <nav class="hidden md:flex md:space-x-8">
                <a href="#about" class="text-gray-600 hover:text-primary transition-colors" data-editable="true">About Us</a>
                <a href="#services" class="text-gray-600 hover:text-primary transition-colors" data-editable="true">Services</a>
                <a href="#projects" class="text-gray-600 hover:text-primary transition-colors" data-editable="true">Projects</a>
                <a href="#contact" class="text-gray-600 hover:text-primary transition-colors" data-editable="true">Contact</a>
            </nav>
            <a href="#contact" class="hidden md:block bg-primary text-white font-semibold py-2 px-4 rounded-md hover:bg-primary/90 transition-colors" data-editable="true">Get Quote</a>
            <button class="md:hidden text-gray-600">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
            </button>
        </div>
    </div>
</header>
      `.trim(),
    },
    {
      name: "Hero Section",
      description: "A large, attention-grabbing hero section with a title and call-to-action.",
      html: `
<section id="hero" data-section-title="Hero Section" class="relative bg-gray-700 text-white py-32 text-center">
    <div class="absolute inset-0 bg-black opacity-60 z-10"></div>
    <div class="relative z-20 max-w-4xl mx-auto px-4">
        <h1 class="text-4xl md:text-6xl font-bold mb-4 leading-tight" data-editable="true">Building Your Vision, Brick by Brick</h1>
        <p class="text-lg md:text-xl mb-8 max-w-2xl mx-auto" data-editable="true">Your trusted partner in construction and contracting, delivering quality and excellence on every project.</p>
        <a href="#contact" class="bg-primary text-white py-3 px-10 rounded-lg text-lg font-semibold hover:bg-primary/90 transition-transform hover:scale-105" data-editable="true">Get a Free Quote</a>
    </div>
</section>
      `.trim(),
    },
    {
      name: "About Us",
      description: "A section to describe your company, mission, and values.",
      html: `
<section id="about" data-section-title="About Us" class="py-20 bg-white">
    <div class="max-w-4xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
        <div class="pr-8">
            <h2 class="text-sm uppercase tracking-widest text-primary font-semibold" data-editable="true">About Our Company</h2>
            <p class="text-3xl font-bold text-gray-800 mt-2" data-editable="true">Decades of Experience in Quality Construction</p>
            <p class="mt-4 text-gray-600" data-editable="true">We are a team of dedicated professionals committed to delivering high-quality construction services. Our expertise spans across residential, commercial, and industrial projects, ensuring every detail is perfected.</p>
        </div>
        <div>
            <img src="https://picsum.photos/seed/aboutus/600/400" alt="Team at work" class="w-full h-auto rounded-lg shadow-xl" data-ai-hint="team work"/>
        </div>
    </div>
</section>
      `.trim(),
    },
    {
        name: "Services Section",
        description: "Showcase the key services your company offers.",
        html: `
<section id="services" data-section-title="Services" class="py-20 bg-gray-50">
    <div class="max-w-6xl mx-auto px-4 text-center">
        <h2 class="text-3xl font-bold text-gray-800 mb-2" data-editable="true">Our Services</h2>
        <p class="text-gray-600 mb-12 max-w-2xl mx-auto" data-editable="true">We offer a wide range of construction services to meet your needs, from initial design to final handover.</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div class="p-8 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow">
                <h3 class="text-xl font-bold text-primary mb-2" data-editable="true">General Contracting</h3>
                <p class="text-gray-600" data-editable="true">Comprehensive project management, from sourcing materials to managing subcontractors, ensuring your project is completed on time and within budget.</p>
            </div>
            <div class="p-8 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow">
                <h3 class="text-xl font-bold text-primary mb-2" data-editable="true">Design-Build</h3>
                <p class="text-gray-600" data-editable="true">A streamlined process where we handle both the design and construction phases, ensuring a cohesive and efficient project flow from start to finish.</p>
            </div>
            <div class="p-8 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow">
                <h3 class="text-xl font-bold text-primary mb-2" data-editable="true">Renovations & Remodeling</h3>
                <p class="text-gray-600" data-editable="true">Transform your existing space with our expert renovation services, whether it's a home, office, or commercial establishment.</p>
            </div>
        </div>
    </div>
</section>
        `.trim(),
    },
    {
      name: "Project Showcase",
      description: "A gallery to display images and details of your past projects.",
      html: `
<section id="projects" data-section-title="Project Showcase" class="py-20 bg-white">
    <div class="max-w-6xl mx-auto px-4">
        <h2 class="text-3xl font-bold text-gray-800 text-center mb-12" data-editable="true">Featured Projects</h2>
        <div class="grid lg:grid-cols-3 gap-8">
            <div class="rounded-lg overflow-hidden shadow-lg group">
                <img src="https://picsum.photos/seed/project1/600/400" alt="Project 1" class="w-full h-48 object-cover group-hover:scale-105 transition-transform" data-ai-hint="construction building"/>
                <div class="p-6">
                    <h3 class="text-xl font-bold mb-2" data-editable="true">Commercial Complex</h3>
                    <p class="text-gray-600 text-sm" data-editable="true">A multi-story commercial building completed in 2023, featuring modern architecture and sustainable design.</p>
                </div>
            </div>
            <div class="rounded-lg overflow-hidden shadow-lg group">
                <img src="https://picsum.photos/seed/project2/600/400" alt="Project 2" class="w-full h-48 object-cover group-hover:scale-105 transition-transform" data-ai-hint="residential house"/>
                <div class="p-6">
                    <h3 class="text-xl font-bold mb-2" data-editable="true">Luxury Villa</h3>
                    <p class="text-gray-600 text-sm" data-editable="true">An exquisite residential villa with custom interiors and landscaping, showcasing fine craftsmanship.</p>
                </div>
            </div>
            <div class="rounded-lg overflow-hidden shadow-lg group">
                <img src="https://picsum.photos/seed/project3/600/400" alt="Project 3" class="w-full h-48 object-cover group-hover:scale-105 transition-transform" data-ai-hint="industrial factory"/>
                <div class="p-6">
                    <h3 class="text-xl font-bold mb-2" data-editable="true">Industrial Warehouse</h3>
                    <p class="text-gray-600 text-sm" data-editable="true">A large-scale industrial warehouse with specialized flooring and high-load capacity structures.</p>
                </div>
            </div>
        </div>
    </div>
</section>
      `.trim(),
    },
    {
      name: "Contact Section",
      description: "A section with your contact information and a form for visitors.",
      html: `
<section id="contact" data-section-title="Contact" class="py-20 bg-gray-50">
    <div class="max-w-4xl mx-auto px-4 text-center">
        <h2 class="text-3xl font-bold text-gray-800" data-editable="true">Get in Touch</h2>
        <p class="text-gray-600 mt-2 mb-8" data-editable="true">We're here to answer any questions you may have. Reach out to us and we'll respond as soon as we can.</p>
        <div class="max-w-xl mx-auto bg-white p-8 rounded-lg shadow-lg">
            [CONTACT_FORM]
        </div>
    </div>
</section>
      `.trim(),
    },
    {
      name: "Footer",
      description: "A simple footer with copyright and social links.",
      html: `
<footer id="footer" data-section-title="Footer" class="bg-gray-800 text-gray-300 py-8">
    <div class="max-w-6xl mx-auto px-4 text-center">
        <p class="text-sm" data-editable="true">&copy; ${new Date().getFullYear()} Your Company Name. All Rights Reserved.</p>
        <div class="flex justify-center space-x-6 mt-4">
            <a href="#" class="hover:text-white" data-editable="true">Facebook</a>
            <a href="#" class="hover:text-white" data-editable="true">Twitter</a>
            <a href="#" class="hover:text-white" data-editable="true">LinkedIn</a>
        </div>
    </div>
</footer>
      `.trim(),
    },
];
