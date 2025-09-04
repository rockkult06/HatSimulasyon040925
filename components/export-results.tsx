"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useSimulation } from "@/context/simulation-context"
import { FileSpreadsheet } from "lucide-react"
import * as XLSX from "xlsx"
import dayjs from "dayjs"

export default function ExportResults() {
  const { stops, passengers, buses, passengerHistory, isCompleted, simulationLogs, simulationParams } = useSimulation()
  const [isExporting, setIsExporting] = useState(false)

  // Excel dışa aktarma fonksiyonunu güncelle - simülasyon olaylarını zaman sıralı olarak ekle
  const exportToExcel = () => {
    setIsExporting(true)

    try {
      // Yeni bir Excel çalışma kitabı oluştur
      const workbook = XLSX.utils.book_new()

      // 1. Durak Özeti Sayfası
      const stopSummaryData = stops.map((stop) => {
        const stopPassengers = passengers.filter((p) => p.boardingStop === stop.id)
        const waitingCount = stopPassengers.filter((p) => p.status === "waiting").length
        const boardedCount = stopPassengers.filter((p) => p.status === "onBus").length
        const arrivedCount = stopPassengers.filter((p) => p.status === "arrived").length
        const totalCount = stopPassengers.length

        // Ortalama bekleme süresi hesapla (varsa)
        let avgWaitingTime = 0
        const passengersWithBoardTime = stopPassengers.filter((p) => p.boardedTime && p.arrivalTime)

        if (passengersWithBoardTime.length > 0) {
          const totalWaitingMinutes = passengersWithBoardTime.reduce((total, p) => {
            const arrivalTime = dayjs(`2023-01-01 ${p.arrivalTime}`)
            const boardedTime = dayjs(`2023-01-01 ${p.boardedTime}`)
            return total + boardedTime.diff(arrivalTime, "minute")
          }, 0)
          avgWaitingTime = totalWaitingMinutes / passengersWithBoardTime.length
        }

        return {
          "Durak ID": stop.id,
          "Durak Adı": stop.name,
          "Durak Sırası": stop.order,
          Hat: stop.route_id,
          "Toplam Yolcu": totalCount,
          "Bekleyen Yolcu": waitingCount,
          "Binmiş Yolcu": boardedCount,
          "Varmış Yolcu": arrivedCount,
          "Ortalama Bekleme Süresi (dk)": avgWaitingTime.toFixed(2),
        }
      })

      const stopSummarySheet = XLSX.utils.json_to_sheet(stopSummaryData)
      XLSX.utils.book_append_sheet(workbook, stopSummarySheet, "Durak Özeti")

      // 2. Yolcu Detayları Sayfası
      const passengerData = passengers.map((p) => {
        const boardingStop = stops.find((s) => s.id === p.boardingStop)
        const alightingStop = stops.find((s) => s.id === p.alightingStop)
        const bus = buses.find((b) => b.id === p.busId)

        // Yolculuk süresi hesapla
        let travelTime = "-"
        if (p.boardedTime && p.arrivedTime) {
          const boardTime = dayjs(`2023-01-01 ${p.boardedTime}`)
          const arriveTime = dayjs(`2023-01-01 ${p.arrivedTime}`)
          travelTime = `${arriveTime.diff(boardTime, "minute")} dk`
        }

        // Bekleme süresi hesapla
        let waitingTime = "-"
        if (p.arrivalTime && p.boardedTime) {
          const arrivalTime = dayjs(`2023-01-01 ${p.arrivalTime}`)
          const boardTime = dayjs(`2023-01-01 ${p.boardedTime}`)
          waitingTime = `${boardTime.diff(arrivalTime, "minute")} dk`
        } else if (p.status === "waiting" && p.arrivalTime) {
          // Taşınamayan yolcular için bekleme süresi hesapla
          const arrivalTime = dayjs(`2023-01-01 ${p.arrivalTime}`)
          const simulationEndTime = dayjs(`2023-01-01 ${simulationParams.startTime}`).add(
            simulationParams.duration,
            "minute",
          )
          waitingTime = `${simulationEndTime.diff(arrivalTime, "minute")} dk`
        }

        return {
          "Yolcu ID": p.id,
          "Varış Zamanı": p.arrivalTime,
          "Biniş Durağı": boardingStop ? boardingStop.name : p.boardingStop,
          "İniş Durağı": alightingStop ? alightingStop.name : p.alightingStop,
          Otobüs: p.busId ? `#${p.busId}` : "-",
          Durum: p.status
            ? p.status === "waiting"
              ? "Bekliyor"
              : p.status === "onBus"
                ? "Otobüste"
                : "Varmış"
            : "Henüz Gelmemiş",
          "Binme Zamanı": p.boardedTime || "-",
          "Varma Zamanı": p.arrivedTime || "-",
          "Bekleme Süresi": waitingTime,
          "Yolculuk Süresi": travelTime,
        }
      })

      const passengerSheet = XLSX.utils.json_to_sheet(passengerData)
      XLSX.utils.book_append_sheet(workbook, passengerSheet, "Yolcu Detayları")

      // 3. Otobüs Detayları Sayfası
      const busData = buses.map((bus) => {
        // Otobüsün taşıdığı toplam yolcu sayısı
        const totalPassengers = passengers.filter((p) => p.busId === bus.id).length

        // Otobüsün şu anki yolcu sayısı
        const currentPassengers = bus.passengers.length

        // Doluluk oranı - tamamlanan otobüsler için maksimum doluluk oranını kullan
        const occupancyRate =
          bus.status === "completed" ? bus.maxOccupancy || 0 : (currentPassengers / bus.capacity) * 100

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

        return {
          "Otobüs ID": bus.id,
          Kapasite: bus.capacity,
          Hat: bus.route_id,
          "Başlangıç Zamanı": bus.start_time,
          "Başlangıç Durağı": bus.start_location_stop_id,
          "Mevcut Durak": bus.current_stop_id || "-",
          "Sonraki Durak": bus.next_stop_id || "-",
          Durum: bus.status === "waiting" ? "Bekliyor" : bus.status === "moving" ? "Hareket Halinde" : "Tamamlandı",
          "Taşınan Toplam Yolcu": totalPassengers,
          "Mevcut Yolcu Sayısı": currentPassengers,
          "Doluluk Oranı (%)": occupancyRate.toFixed(2),
          "Sefer Süresi": travelTime,
          "Ek Sefer": bus.isExtra ? "Evet" : "Hayır",
        }
      })

      const busSheet = XLSX.utils.json_to_sheet(busData)
      XLSX.utils.book_append_sheet(workbook, busSheet, "Otobüs Detayları")

      // 4. Durak Geçmişi Sayfası
      const historyData = passengerHistory.map((entry) => {
        const stop = stops.find((s) => s.id === entry.stopId)
        return {
          Zaman: entry.time,
          Durak: stop ? stop.name : entry.stopId,
          "Bekleyen Yolcu": entry.waiting,
          "Binen Yolcu": entry.boarded,
          "İnen Yolcu": entry.alighted,
        }
      })

      const historySheet = XLSX.utils.json_to_sheet(historyData)
      XLSX.utils.book_append_sheet(workbook, historySheet, "Durak Geçmişi")

      // 5. İstatistikler Sayfası
      const totalPassengers = passengers.length
      const completedPassengers = passengers.filter((p) => p.status === "arrived").length
      const completionRate = totalPassengers > 0 ? (completedPassengers / totalPassengers) * 100 : 0

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

      // Ortalama sefer süresi
      let avgBusTravelTime = 0
      const completedBuses = buses.filter((b) => b.status === "completed" && b.completion_time)
      if (completedBuses.length > 0) {
        const totalBusTravelMinutes = completedBuses.reduce((total, bus) => {
          const startTime = dayjs(`2023-01-01 ${bus.start_time}:00`)
          const endTime = dayjs(`2023-01-01 ${bus.completion_time}`)
          return total + endTime.diff(startTime, "minute")
        }, 0)
        avgBusTravelTime = totalBusTravelMinutes / completedBuses.length
      }

      const statsData = [
        { İstatistik: "Toplam Durak Sayısı", Değer: stops.length },
        { İstatistik: "Toplam Otobüs Sayısı", Değer: buses.length },
        { İstatistik: "Tamamlanan Otobüs Sayısı", Değer: completedBuses.length },
        { İstatistik: "Toplam Yolcu Sayısı", Değer: totalPassengers },
        { İstatistik: "Tamamlanan Yolcu Sayısı", Değer: completedPassengers },
        { İstatistik: "Tamamlanma Oranı (%)", Değer: completionRate.toFixed(2) },
        { İstatistik: "Ortalama Yolcu Yolculuk Süresi (dk)", Değer: avgTravelTime.toFixed(2) },
        { İstatistik: "Ortalama Yolcu Bekleme Süresi (dk)", Değer: avgWaitingTime.toFixed(2) },
        { İstatistik: "Ortalama Otobüs Sefer Süresi (dk)", Değer: avgBusTravelTime.toFixed(2) },
      ]

      const statsSheet = XLSX.utils.json_to_sheet(statsData)
      XLSX.utils.book_append_sheet(workbook, statsSheet, "İstatistikler")

      // 6. Simülasyon Olayları Sayfası (YENİ)
      const simulationEvents = [...simulationLogs].sort((a, b) => {
        return dayjs(`2023-01-01 ${a.time}`).diff(dayjs(`2023-01-01 ${b.time}`))
      })

      const eventsData = simulationEvents.map((event, index) => {
        return {
          "Sıra No": index + 1,
          Zaman: event.time,
          Olay: event.message,
        }
      })

      const eventsSheet = XLSX.utils.json_to_sheet(eventsData)
      XLSX.utils.book_append_sheet(workbook, eventsSheet, "Simülasyon Olayları")

      // Excel dosyasını indir - browser uyumlu yöntem
      const currentDate = new Date().toISOString().slice(0, 19).replace(/:/g, "-")
      const fileName = `Simülasyon_Sonuçları_${currentDate}.xlsx`

      // Browser'da dosya indirme işlemi
      const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
      const blob = new Blob([wbout], { type: "application/octet-stream" })

      // Dosya indirme bağlantısı oluştur
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
      a.click()

      // Temizlik
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
      }, 100)
    } catch (error) {
      console.error("Excel dışa aktarma hatası:", error)
      alert("Excel dışa aktarma sırasında bir hata oluştu.")
    } finally {
      setIsExporting(false)
    }
  }

  // ExportResults bileşeninde, disabled özelliğini düzelt
  return (
    <Button onClick={exportToExcel} disabled={isExporting} className="w-full">
      {isExporting ? (
        <>Dışa Aktarılıyor...</>
      ) : (
        <>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Sonuçları Excel'e Aktar
        </>
      )}
    </Button>
  )
}
