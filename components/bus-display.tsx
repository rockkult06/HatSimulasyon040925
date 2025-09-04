"use client"
import { useEffect, useState } from "react"
import type { Bus } from "@/context/simulation-context"
import type { Stop } from "@/context/simulation-context"
import { BusIcon, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface BusDisplayProps {
  bus: Bus
  stops: Stop[]
  stopRows?: Stop[][]
  stopsPerRow?: number
}

export default function BusDisplay({ bus, stops, stopRows, stopsPerRow }: BusDisplayProps) {
  const [position, setPosition] = useState({ left: "0px", top: "0px" })

  // Otobüs dolu mu kontrolü - tam dolu olduğunda true
  const isFull = bus.passengers.length >= bus.capacity
  // Ek sefer mi kontrolü
  const isExtra = bus.isExtra === true

  const stopWidth = 120
  const rowHeight = 120 // Height between rows
  const baseTopOffset = 80 // Starting top position

  useEffect(() => {
    if (!bus.current_stop_id || !stopRows || !stopsPerRow) return

    // Find current stop index in the original stops array
    const currentStopIndex = stops.findIndex((stop) => stop.id === bus.current_stop_id)
    if (currentStopIndex === -1) return

    // Calculate which row and position within row
    const rowIndex = Math.floor(currentStopIndex / stopsPerRow)
    let positionInRow = currentStopIndex % stopsPerRow

    // For odd rows (snake pattern), reverse the position
    if (rowIndex % 2 === 1) {
      positionInRow = stopsPerRow - 1 - positionInRow
    }

    // Calculate pixel positions
    const leftPosition = 32 + positionInRow * (stopWidth + 16) + stopWidth / 2
    const topPosition = baseTopOffset + rowIndex * rowHeight

    // If bus is moving, adjust position to be between stops
    if (bus.status === "moving" && bus.next_stop_id) {
      const nextStopIndex = stops.findIndex((stop) => stop.id === bus.next_stop_id)
      if (nextStopIndex !== -1) {
        const nextRowIndex = Math.floor(nextStopIndex / stopsPerRow)
        let nextPositionInRow = nextStopIndex % stopsPerRow

        // For odd rows, reverse the position
        if (nextRowIndex % 2 === 1) {
          nextPositionInRow = stopsPerRow - 1 - nextPositionInRow
        }

        const nextLeftPosition = 32 + nextPositionInRow * (stopWidth + 16) + stopWidth / 2
        const nextTopPosition = baseTopOffset + nextRowIndex * rowHeight

        // Calculate midpoint
        const midLeft = (leftPosition + nextLeftPosition) / 2
        const midTop = (topPosition + nextTopPosition) / 2

        setPosition({ left: `${midLeft}px`, top: `${midTop}px` })
        return
      }
    }

    setPosition({ left: `${leftPosition}px`, top: `${topPosition}px` })
  }, [bus, stops, stopRows, stopsPerRow])

  // Don't show completed buses
  if (bus.status === "completed") return null

  return (
    <div
      className="absolute z-20 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500"
      style={{ left: position.left, top: position.top }}
    >
      <div className={cn("flex flex-col items-center", bus.status === "moving" ? "animate-pulse" : "")}>
        <Badge
          className={cn(
            "px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 shadow-md",
            isExtra
              ? "bg-black text-white" // Ek seferler için siyah dolgulu
              : isFull
                ? "bg-red-500 text-white"
                : bus.status === "waiting"
                  ? "bg-green-500 text-white"
                  : "bg-blue-500 text-white",
          )}
        >
          <BusIcon className="h-3 w-3" />#{bus.id}
        </Badge>
        <div className="flex items-center mt-1 bg-white px-2 py-0.5 rounded-full shadow-sm text-xs">
          <User className="h-3 w-3 mr-1 text-gray-600" />
          <span>
            {bus.passengers.length}/{bus.capacity}
          </span>
        </div>
      </div>
    </div>
  )
}
