"use client"
import { useEffect, useState } from "react" // useState'i ekleyin
import SimulationControl from "@/components/simulation-control"
import SimulationView from "@/components/simulation-view"
import DataUploader from "@/components/data-uploader"
import ExportResults from "@/components/export-results"
import SimulationResults from "@/components/simulation-results"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { SimulationProvider, useSimulation } from "@/context/simulation-context"
import BusMonitor from "@/components/bus-monitor"

// Ana içerik bileşeni - SimulationProvider dışında
function MainContent() {
  const { isCompleted } = useSimulation()
  const [activeTab, setActiveTab] = useState("simulation")

  // Simülasyon tamamlandığında sonuçlar sekmesine yönlendir
  useEffect(() => {
    if (isCompleted) {
      setActiveTab("results")
    }
  }, [isCompleted])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <Card className="rounded-xl shadow-md">
          <CardHeader className="pb-2">
            <CardTitle>Simülasyon Kontrolleri</CardTitle>
            <CardDescription>Simülasyon parametrelerini ayarlayın ve başlatın</CardDescription>
          </CardHeader>
          <CardContent>
            <SimulationControl />
          </CardContent>
          <CardFooter>
            <ExportResults />
          </CardFooter>
        </Card>

        <Card className="mt-6 rounded-xl shadow-md">
          <CardHeader className="pb-2">
            <CardTitle>Veri Yükleme</CardTitle>
            <CardDescription>Kendi verilerinizi yükleyin veya varsayılan verileri kullanın</CardDescription>
          </CardHeader>
          <CardContent>
            <DataUploader />
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Tabs value={activeTab} onValueChange={setActiveTab} id="main-tabs">
          <TabsList className="mb-4">
            <TabsTrigger value="simulation">Simülasyon</TabsTrigger>
            <TabsTrigger value="buses">Otobüsler</TabsTrigger>
            <TabsTrigger value="results">Sonuçlar</TabsTrigger>
          </TabsList>

          <TabsContent value="simulation">
            <Card className="rounded-xl shadow-md">
              <CardHeader className="pb-2">
                <CardTitle>Simülasyon Görünümü</CardTitle>
                <CardDescription>Duraklar, otobüsler ve yolcu hareketleri</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <SimulationView />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="buses">
            <Card className="rounded-xl shadow-md">
              <CardHeader className="pb-2">
                <CardTitle>Otobüs İzleme</CardTitle>
                <CardDescription>Otobüslerin anlık durumu ve istatistikleri</CardDescription>
              </CardHeader>
              <CardContent>
                <BusMonitor />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results" id="results">
            <Card className="rounded-xl shadow-md">
              <CardHeader className="pb-2">
                <CardTitle>Simülasyon Sonuçları</CardTitle>
                <CardDescription>İstatistikler ve detaylı veriler</CardDescription>
              </CardHeader>
              <CardContent>
                <SimulationResults />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Hat Simülasyon Modeli</h1>

      <SimulationProvider>
        <MainContent />
      </SimulationProvider>
    </main>
  )
}
