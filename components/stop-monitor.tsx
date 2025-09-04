"use client"
import { useSimulation } from "@/context/simulation-context"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { formatTime } from "@/lib/utils"
import { Bus } from "lucide-react"

interface StopMonitorProps {
  stopId: number
  detailed?: boolean
}

export default function StopMonitor({ stopId, detailed = false }: StopMonitorProps) {
  const { stops, waitingPassengers, passengerHistory, currentTime } = useSimulation()

  const stop = stops.find((s) => s.id === stopId)

  // Durak bulunamadığında daha açıklayıcı bir mesaj göster
  if (!stop) {
    console.warn(`Durak bulunamadı: ID=${stopId}, Mevcut duraklar:`, stops)
    return (
      <Card className={detailed ? "h-full" : "h-[200px]"}>
        <CardContent className="p-3 h-full flex flex-col items-center justify-center">
          <div className="text-muted-foreground text-sm">Durak #{stopId} bulunamadı</div>
        </CardContent>
      </Card>
    )
  }

  const waitingCount = waitingPassengers.filter((p) => p.boardingStop === stopId).length

  // Get history data for this stop
  const stopHistory = passengerHistory
    .filter((entry) => entry.stopId === stopId)
    .map((entry) => ({
      time: formatTime(entry.time),
      waiting: entry.waiting,
    }))

  return (
    <Card className={detailed ? "h-full" : "h-[200px]"}>
      <CardContent className="p-3 h-full flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{stop.name}</h3>
            <Badge
              variant="outline"
              className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1 text-xs"
            >
              <Bus className="h-3 w-3" />
              {stop.route_id}
            </Badge>
          </div>
          <Badge variant={waitingCount > 0 ? "default" : "outline"}>{waitingCount} Yolcu</Badge>
        </div>

        <div className="flex-1 min-h-[100px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stopHistory} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={detailed ? 0 : "preserveStartEnd"} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="waiting" name="Bekleyen" stroke="#2563eb" activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
