import { Hero } from '@/components/Hero'
import { SearchBar } from '@/components/SearchBar'
import { StatsBar } from '@/components/StatsBar'
import { RarityGrid } from '@/components/RarityGrid'
import { config } from '@/config'

export default function Home() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
      <Hero />

      {/* Search pinned near the top, as requested. */}
      <div className="flex flex-col gap-4">
        <SearchBar autoFocus />
        {config.features.liveStats && <StatsBar />}
      </div>

      <RarityGrid />
    </div>
  )
}
