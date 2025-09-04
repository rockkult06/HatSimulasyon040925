"use client"
import { useEffect, useState } from "react"
import { useSimulation } from "@/context/simulation-context"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { User, Bus, CheckCircle2, Activity } from "lucide-react"
import { formatTime } from "@/lib/utils"
import BusDisplay from "@/components/bus-display"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function SimulationView() {
  const { isCompleted, currentTime, stops, waitingPassengers, buses, simulationLogs } = useSimulation()
  const router = useRouter()
  const [showCompletionAlert, setShowCompletionAlert] = useState(false)

  // Tüm durakların route_id'sini al (genellikle hepsi aynı olacak)
  const routeId = stops.length > 0 ? stops[0].route_id : "171"

  const containerWidth = 800 // Approximate container width
  const stopWidth = 120
  const stopMargin = 16
  const stopsPerRow = Math.floor(containerWidth / (stopWidth + stopMargin))
  const totalRows = Math.ceil(stops.length / stopsPerRow)

  const rowHeight = 120 // Height for each row (card height + spacing)
  const topPadding = 80 // Space for time and route displays
  const bottomPadding = 40 // Bottom spacing
  const dynamicHeight = Math.max(400, topPadding + totalRows * rowHeight + bottomPadding)

  const arrangeStopsInRows = () => {
    const rows = []
    for (let i = 0; i < totalRows; i++) {
      const startIndex = i * stopsPerRow
      const endIndex = Math.min(startIndex + stopsPerRow, stops.length)
      const rowStops = stops.slice(startIndex, endIndex)

      // Alternate row direction for snake-like pattern
      if (i % 2 === 1) {
        rowStops.reverse()
      }

      rows.push(rowStops)
    }
    return rows
  }

  const stopRows = arrangeStopsInRows()

  // Simülasyon tamamlandığında bildirim göster
  useEffect(() => {
    if (isCompleted) {
      setShowCompletionAlert(true)
    }
  }, [isCompleted])

  return (
    <div className="relative space-y-4">
      {/* Ana simülasyon görünümü kartı */}
      <div
        className="relative w-full bg-gray-50 rounded-xl overflow-hidden p-8"
        style={{ height: `${dynamicHeight}px` }}
      >
        {/* Time display */}
        <div className="absolute top-4 right-4 bg-black text-white px-4 py-2 rounded-md font-mono text-lg shadow-md z-30">
          {formatTime(currentTime)}
        </div>

        {/* Route ID display */}
        <div className="absolute top-4 left-4 flex items-center z-30">
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1 px-3 py-1 shadow-sm"
          >
            <Bus className="h-4 w-4" />
            Hat: {routeId}
          </Badge>
        </div>

        {/* Simulation completed message */}
        {showCompletionAlert && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md mx-auto animate-in fade-in zoom-in duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-green-100 p-2 rounded-full">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Simülasyon Tamamlandı</h3>
                  <p className="text-gray-500">Tüm sonuçlar hazır, detayları inceleyebilirsiniz.</p>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    setShowCompletionAlert(false)
                    router.push("#results")
                    // Sonuçlar sekmesine geçiş için DOM manipülasyonu
                    const resultsTab = document.querySelector('[value="results"]') as HTMLElement
                    if (resultsTab) resultsTab.click()
                  }}
                >
                  Sonuçları İncele
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 bg-transparent"
                  onClick={() => setShowCompletionAlert(false)}
                >
                  Kapat
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="relative pt-16">
          {stops.length > 0 ? (
            <div className="space-y-8">
              {stopRows.map((rowStops, rowIndex) => (
                <div key={rowIndex} className="relative">
                  {/* Row container */}
                  <div className="flex items-center justify-start gap-4 relative">
                    {/* Horizontal line for this row */}
                    <div className="absolute top-1/2 left-0 right-0 h-1 bg-blue-300 z-0"></div>

                    {/* Stops in this row */}
                    {rowStops.map((stop, stopIndex) => {
                      const waitingCount = waitingPassengers.filter((p) => p.boardingStop === stop.id).length
                      const originalIndex = stops.findIndex((s) => s.id === stop.id)

                      return (
                        <div
                          key={stop.id}
                          className="relative z-10 flex flex-col items-center"
                          style={{ width: `${stopWidth}px` }}
                        >
                          {/* Stop indicator dot */}
                          <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-md mb-2"></div>

                          <Card className="w-full shadow-md border-0 rounded-xl">
                            <CardContent className="p-3 text-center">
                              <div className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full mb-2 inline-block">
                                {originalIndex + 1}
                              </div>
                              <h3 className="font-bold text-sm mb-2 leading-tight">
                                {stop.name.length > 15 ? `${stop.name.substring(0, 15)}...` : stop.name}
                              </h3>
                              {stop.id !== 0 ? (
                                <div className="flex items-center justify-center">
                                  <User className="h-4 w-4 mr-1 text-blue-600" />
                                  <span className="text-sm font-semibold">{waitingCount}</span>
                                </div>
                              ) : (
                                <div className="h-5"></div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      )
                    })}
                  </div>

                  {rowIndex < stopRows.length - 1 && (
                    <div className="absolute right-0 top-1/2 w-1 h-8 bg-blue-300 z-0"></div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full text-center text-gray-500 py-10">
              Durak verisi bulunamadı. Lütfen veri yükleyin veya varsayılan verileri kullanın.
            </div>
          )}

          {buses.map((bus) => {
            return <BusDisplay key={bus.id} bus={bus} stops={stops} stopRows={stopRows} stopsPerRow={stopsPerRow} />
          })}
        </div>
      </div>

      {/* Simülasyon olayları - ayrı bir kart olarak */}
      <div className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm">
        <h4 className="text-sm font-semibold mb-2 text-gray-700 flex items-center">
          <Activity className="h-4 w-4 mr-2" />
          Simülasyon Olayları
        </h4>
        <div className="space-y-1 max-h-[150px] overflow-y-auto">
          {simulationLogs.slice(-10).length > 0 ? (
            simulationLogs.slice(-10).map((log, index) => (
              <div key={index} className="text-xs text-gray-600 flex items-start gap-2">
                <span className="font-mono text-gray-500 whitespace-nowrap">{log.time}</span>
                <span>{log.message}</span>
              </div>
            ))
          ) : (
            <div className="text-xs text-gray-500 italic">Henüz olay kaydı yok. Simülasyonu başlatın.</div>
          )}
        </div>
      </div>
    </div>
  )
}
