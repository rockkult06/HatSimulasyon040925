"use client"
import { useSimulation } from "@/context/simulation-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Bus, User, Clock, Timer } from "lucide-react"
import dayjs from "dayjs"

export default function SimulationResults() {
  const { stops, passengers, buses, isCompleted, simulationParams } = useSimulation()

  // Tamamlanan yolcu sayısı
  const completedPassengers = passengers.filter((p) => p.status === "arrived").length
  const completionRate = passengers.length > 0 ? (completedPassengers / passengers.length) * 100 : 0

  // Ortalama yolculuk süresi
  let avgTravelTime = 0
  const passengersWithFullJourney = passengers.filter((p) => p.boardedTime && p.arrivedTime)
  if (passengersWithFullJourney.length > 0) {
    const totalTravelMinutes = passengersWithFullJourney.reduce((total, p) => {
      const boardTime = dayjs(`2023-01-01 ${p.boardedTime}`)
      const arriveTime = dayjs(`2023-01-01 ${p.arrivedTime}`)
      return total + arriveTime.diff(boardTime, "minute")
    }, 0)
    avgTravelTime = totalTravelMinutes / passengersWithFullJourney.length
  }

  // Ortalama bekleme süresi
  let avgWaitingTime = 0
  const passengersWithWaitTime = passengers.filter((p) => p.arrivalTime && p.boardedTime)
  if (passengersWithWaitTime.length > 0) {
    const totalWaitingMinutes = passengersWithWaitTime.reduce((total, p) => {
      const arrivalTime = dayjs(`2023-01-01 ${p.arrivalTime}`)
      const boardTime = dayjs(`2023-01-01 ${p.boardedTime}`)
      return total + boardTime.diff(arrivalTime, "minute")
    }, 0)
    avgWaitingTime = totalWaitingMinutes / passengersWithWaitTime.length
  }

  return (
    <div className="space-y-4">
      {/* KPI Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-2">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold">
              {completedPassengers}/{passengers.length}
            </h3>
            <p className="text-sm text-muted-foreground">Tamamlanan Yolcular</p>
            <Badge className="mt-1" variant={completionRate > 80 ? "default" : "outline"}>
              %{completionRate.toFixed(0)}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-2">
              <Bus className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-bold">{buses.length}</h3>
            <p className="text-sm text-muted-foreground">Toplam Otobüs</p>
            <Badge className="mt-1" variant="outline">
              Hat: {buses.length > 0 ? buses[0].route_id : "-"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 mb-2">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold">{avgWaitingTime.toFixed(1)} dk</h3>
            <p className="text-sm text-muted-foreground">Ortalama Bekleme</p>
            <Badge className="mt-1" variant={avgWaitingTime < 10 ? "default" : "outline"}>
              {avgWaitingTime < 5 ? "Çok İyi" : avgWaitingTime < 10 ? "İyi" : "Geliştirilebilir"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 mb-2">
              <Timer className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-bold">{avgTravelTime.toFixed(1)} dk</h3>
            <p className="text-sm text-muted-foreground">Ortalama Yolculuk</p>
            <Badge className="mt-1" variant={avgTravelTime < 15 ? "default" : "outline"}>
              {avgTravelTime < 10 ? "Çok İyi" : avgTravelTime < 15 ? "İyi" : "Geliştirilebilir"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Detaylı Tablolar */}
      <Tabs defaultValue="passengers">
        <TabsList className="mb-4">
          <TabsTrigger value="passengers">Yolcular</TabsTrigger>
          <TabsTrigger value="buses">Otobüsler</TabsTrigger>
          <TabsTrigger value="stops">Duraklar</TabsTrigger>
        </TabsList>

        <TabsContent value="passengers">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Yolcu Detayları</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Durak Gelişi</TableHead>
                      <TableHead>Biniş Durağı</TableHead>
                      <TableHead>İniş Durağı</TableHead>
                      <TableHead>Otobüs</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Bekleme</TableHead>
                      <TableHead>Yolculuk</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {passengers.map((passenger) => {
                      const boardingStop = stops.find((s) => s.id === passenger.boardingStop)
                      const alightingStop = stops.find((s) => s.id === passenger.alightingStop)

                      // Bekleme süresi hesapla
                      let waitingTime = "-"
                      if (passenger.arrivalTime && passenger.boardedTime) {
                        const arrivalTime = dayjs(`2023-01-01 ${passenger.arrivalTime}`)
                        const boardTime = dayjs(`2023-01-01 ${passenger.boardedTime}`)
                        waitingTime = `${boardTime.diff(arrivalTime, "minute")} dk`
                      } else if (passenger.status === "waiting" && passenger.arrivalTime) {
                        // Taşınamayan yolcular için bekleme süresi hesapla
                        const arrivalTime = dayjs(`2023-01-01 ${passenger.arrivalTime}`)
                        const simulationEndTime = dayjs(`2023-01-01 ${simulationParams.startTime}`).add(
                          simulationParams.duration,
                          "minute",
                        )
                        waitingTime = `${simulationEndTime.diff(arrivalTime, "minute")} dk`
                      }

                      // Yolculuk süresi hesapla
                      let travelTime = "-"
                      if (passenger.boardedTime && passenger.arrivedTime) {
                        const boardTime = dayjs(`2023-01-01 ${passenger.boardedTime}`)
                        const arriveTime = dayjs(`2023-01-01 ${passenger.arrivedTime}`)
                        travelTime = `${arriveTime.diff(boardTime, "minute")} dk`
                      }

                      // Durum metnini daha açıklayıcı hale getir
                      let statusText = "Henüz Gelmemiş"
                      let statusVariant: "default" | "secondary" | "outline" = "outline"

                      if (passenger.status === "waiting") {
                        statusText = "Durakta"
                        statusVariant = "outline"
                      } else if (passenger.status === "onBus") {
                        statusText = "Otobüste"
                        statusVariant = "secondary"
                      } else if (passenger.status === "arrived") {
                        statusText = "Vardı"
                        statusVariant = "default"
                      }

                      return (
                        <TableRow key={passenger.id}>
                          <TableCell>{passenger.id}</TableCell>
                          <TableCell>{passenger.arrivalTime}</TableCell>
                          <TableCell>{boardingStop?.name || passenger.boardingStop}</TableCell>
                          <TableCell>{alightingStop?.name || passenger.alightingStop}</TableCell>
                          <TableCell>{passenger.busId ? `#${passenger.busId}` : "-"}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant}>{statusText}</Badge>
                          </TableCell>
                          <TableCell>{waitingTime}</TableCell>
                          <TableCell>{travelTime}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="buses">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Otobüs Detayları</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Kapasite</TableHead>
                      <TableHead>Başlangıç</TableHead>
                      <TableHead>Başlangıç Durağı</TableHead>
                      <TableHead>Mevcut Durak</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Yolcu</TableHead>
                      <TableHead>Doluluk</TableHead>
                      <TableHead>Sefer Süresi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {buses.map((bus) => {
                      const startStop = stops.find((s) => s.id === bus.start_location_stop_id)
                      const currentStop = stops.find((s) => s.id === bus.current_stop_id)

                      // Doluluk oranı - tamamlanan otobüsler için maksimum doluluk oranını kullan
                      const occupancyRate =
                        bus.status === "completed"
                          ? bus.maxOccupancy || 0
                          : (bus.passengers.length / bus.capacity) * 100

                      // Sefer süresi hesapla
                      let travelTime = "-"
                      if (bus.status === "completed" && bus.completion_time) {
                        const startTime = dayjs(`2023-01-01 ${bus.start_time}:00`)
                        const endTime = dayjs(`2023-01-01 ${bus.completion_time}`)
                        const durationMinutes = endTime.diff(startTime, "minute")
                        const hours = Math.floor(durationMinutes / 60)
                        const minutes = durationMinutes % 60
                        travelTime = hours > 0 ? `${hours}s ${minutes}dk` : `${minutes}dk`
                      }

                      return (
                        <TableRow key={bus.id}>
                          <TableCell>{bus.id}</TableCell>
                          <TableCell>{bus.capacity}</TableCell>
                          <TableCell>{bus.start_time}</TableCell>
                          <TableCell>{startStop?.name || bus.start_location_stop_id}</TableCell>
                          <TableCell>{currentStop?.name || "-"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                bus.status === "completed"
                                  ? "default"
                                  : bus.status === "moving"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {bus.status === "waiting"
                                ? "Bekliyor"
                                : bus.status === "moving"
                                  ? "Hareket Halinde"
                                  : "Tamamlandı"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {bus.passengers.length}/{bus.capacity}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={occupancyRate > 80 ? "default" : occupancyRate > 50 ? "secondary" : "outline"}
                            >
                              %{occupancyRate.toFixed(0)}
                            </Badge>
                          </TableCell>
                          <TableCell>{travelTime}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stops">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Durak Detayları</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Durak Adı</TableHead>
                      <TableHead>Sıra</TableHead>
                      <TableHead>Hat</TableHead>
                      <TableHead>Sonraki Durağa Süre</TableHead>
                      <TableHead>Toplam Yolcu</TableHead>
                      <TableHead>Bekleyen</TableHead>
                      <TableHead>Tamamlanan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stops.map((stop) => {
                      const stopPassengers = passengers.filter((p) => p.boardingStop === stop.id)
                      const waitingCount = stopPassengers.filter((p) => p.status === "waiting").length
                      const completedCount = stopPassengers.filter((p) => p.status === "arrived").length

                      return (
                        <TableRow key={stop.id}>
                          <TableCell>{stop.id}</TableCell>
                          <TableCell>{stop.name}</TableCell>
                          <TableCell>{stop.order}</TableCell>
                          <TableCell>{stop.route_id}</TableCell>
                          <TableCell>{stop.timeToNext !== null ? `${stop.timeToNext} sn` : "-"}</TableCell>
                          <TableCell>{stopPassengers.length}</TableCell>
                          <TableCell>{waitingCount}</TableCell>
                          <TableCell>{completedCount}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
