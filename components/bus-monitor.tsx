"use client"
import { useSimulation } from "@/context/simulation-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatTime, formatDuration } from "@/lib/utils"
import { Bus, Users, Clock, BarChart, CheckCircle, MapPin } from "lucide-react"

export default function BusMonitor() {
  const { buses, stops, isCompleted } = useSimulation()

  // Aktif ve tamamlanmış otobüsleri ayır
  const activeBuses = buses.filter((bus) => bus.status !== "completed")
  const completedBuses = buses.filter((bus) => bus.status === "completed")

  // Durak adını ID'ye göre bul
  const getStopName = (stopId: number) => {
    const stop = stops.find((s) => s.id === stopId)
    return stop ? stop.name : `Durak ${stopId}`
  }

  // Otobüsün mevcut konumunu bul
  const getBusLocation = (bus: any) => {
    if (bus.currentStopId !== undefined) {
      return getStopName(bus.currentStopId)
    } else if (bus.nextStopId !== undefined) {
      const prevStop = stops.find((s) => s.id === bus.prevStopId)
      const nextStop = stops.find((s) => s.id === bus.nextStopId)
      if (prevStop && nextStop) {
        return `${prevStop.name} → ${nextStop.name}`
      }
    }
    return "Bilinmiyor"
  }

  // Doluluk oranını hesapla
  const calculateOccupancy = (bus: any) => {
    if (!bus.capacity) return 0
    return Math.round((bus.passengers.length / bus.capacity) * 100)
  }

  // Maksimum doluluk oranını hesapla
  const calculateMaxOccupancy = (bus: any) => {
    if (!bus.maxPassengers || !bus.capacity) return 0
    return Math.round((bus.maxPassengers / bus.capacity) * 100)
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="active">
        <TabsList className="mb-4">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Bus className="h-4 w-4" />
            Aktif Otobüsler
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Tamamlanan Otobüsler
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {activeBuses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeBuses.map((bus) => (
                <Card key={bus.id} className="overflow-hidden">
                  <CardHeader className="pb-2 bg-gray-50">
                    <CardTitle className="text-base flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bus className="h-5 w-5 text-blue-600" />
                        Otobüs #{bus.id}
                      </div>
                      <Badge variant={bus.isExtra ? "default" : "outline"}>
                        {bus.isExtra ? "Ek Sefer" : "Normal Sefer"}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">Konum:</span>
                      </div>
                      <span>{getBusLocation(bus)}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">Doluluk:</span>
                      </div>
                      <span>
                        {bus.passengers.length} / {bus.capacity} yolcu
                      </span>
                    </div>

                    <Progress value={calculateOccupancy(bus)} className="h-2" />

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">Başlangıç:</span>
                      </div>
                      <span>{bus.start_time}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {isCompleted
                ? "Tüm otobüsler seferlerini tamamladı."
                : "Henüz aktif otobüs bulunmuyor. Simülasyonu başlatın."}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed">
          {completedBuses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedBuses.map((bus) => (
                <Card key={bus.id} className="overflow-hidden">
                  <CardHeader className="pb-2 bg-gray-50">
                    <CardTitle className="text-base flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bus className="h-5 w-5 text-green-600" />
                        Otobüs #{bus.id}
                      </div>
                      <Badge variant={bus.isExtra ? "default" : "outline"}>
                        {bus.isExtra ? "Ek Sefer" : "Normal Sefer"}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">Taşınan Yolcu:</span>
                      </div>
                      <span>{bus.totalPassengers || 0} yolcu</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <BarChart className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">Maks. Doluluk:</span>
                      </div>
                      <span>
                        {bus.maxPassengers || 0} / {bus.capacity} yolcu ({calculateMaxOccupancy(bus)}%)
                      </span>
                    </div>

                    <Progress value={calculateMaxOccupancy(bus)} className="h-2" />

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">Sefer Süresi:</span>
                      </div>
                      <span>{formatDuration(bus.tripDuration || 0)}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">Tamamlanma:</span>
                      </div>
                      <span>{bus.completionTime ? formatTime(bus.completionTime) : "-"}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">Henüz tamamlanan otobüs bulunmuyor.</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
