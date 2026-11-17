import HeroSection from "@/components/home/HeroSection";
import SearchSection from "@/components/home/SearchSection";
import ServiceCategories from "@/components/home/ServiceCategories";
import FeaturedServices from "@/components/home/FeaturedServices";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <SearchSection />
      <ServiceCategories />
      <FeaturedServices />
    </main>
  );
}
