import HeroSection from "@/components/home/HeroSection";
import SearchSection from "@/components/home/SearchSection";
import ServiceCategories from "@/components/home/ServiceCategories";
import FeaturedServices from "@/components/home/FeaturedServices";
import HowItWorks from "@/components/home/HowItWorks";
import WhyChooseFixMate from "@/components/home/WhyChooseFixMate";
import Testimonials from "@/components/home/Testimonials";
import FinalCTA from "@/components/home/FinalCTA";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <SearchSection />
      <ServiceCategories />
      <FeaturedServices />
      <HowItWorks />
      <WhyChooseFixMate />
      <Testimonials />
      <FinalCTA />
    </main>
  );
}
