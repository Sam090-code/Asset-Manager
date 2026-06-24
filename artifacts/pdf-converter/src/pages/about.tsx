import { Layout } from "@/components/layout/Layout";

export default function About() {
  return (
    <Layout>
      <div className="container max-w-3xl mx-auto py-12 px-4 md:px-8">
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground mb-4">About DocuFlow</h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              A no-nonsense file utility designed for students, professionals, and businesses who need to get things done quickly without compromising on quality or privacy.
            </p>
          </div>

          <div className="prose prose-slate dark:prose-invert max-w-none">
            <h3>What we do</h3>
            <p>
              DocuFlow provides two essential tools in a clean, distraction-free interface:
            </p>
            <ul>
              <li>
                <strong>Image to PDF Converter:</strong> A fully client-side tool that takes your images and perfectly formats them into a single PDF document. Because processing happens in your browser, your sensitive documents never leave your device.
              </li>
              <li>
                <strong>Smart File Compressor:</strong> An intelligent compression engine that significantly reduces file sizes while maintaining visual quality. Perfect for meeting email attachment limits or optimizing web assets.
              </li>
            </ul>

            <h3>Our Philosophy</h3>
            <p>
              Most free online tools are filled with ads, confusing navigation, and questionable privacy practices. We built DocuFlow to be the exact opposite. It's the tool we wanted for ourselves—fast, reliable, and respectful of your time and data.
            </p>
            <p>
              There's no registration required, no hidden fees, and no marketing fluff. Just select your files, choose your settings, and get your results instantly.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
