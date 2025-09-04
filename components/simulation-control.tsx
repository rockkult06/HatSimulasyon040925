"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { useSimulation } from "@/context/simulation-context"
import { Play, Pause, StepForward, Square, RotateCcw, Plus, Bus, Zap } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import dayjs from "dayjs"

// ExtraBusForm bileşenini güncelle - destinationStopId kullanacak şekilde
function ExtraBusForm() {
  const { stops, addExtraBus } = useSimulation()
  const [frequency, setFrequency] = useState("15")
  const [startTime, setStartTime] = useState("07:00")
  const [startStopId, setStartStopId] = useState("")
  const [destinationStopId, setDestinationStopId] = useState("") // endStopId yerine destinationStopId kullan
  const [capacity, setCapacity] = useState("30")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleAddExtraBus = () => {
    // Hata ve başarı mesajlarını temizle
    setError(null)
    setSuccess(null)

    // Validasyon
    if (!startStopId || !destinationStopId) {
      setError("Başlangıç ve bitiş duraklarını seçmelisiniz")
      return
    }

    if (startStopId === destinationStopId) {
      setError("Başlangıç ve bitiş durakları aynı olamaz")
      return
    }

    const startStopOrder = stops.find((s) => s.id === Number(startStopId))?.order
    const destinationStopOrder = stops.find((s) => s.id === Number(destinationStopId))?.order

    if (startStopOrder && destinationStopOrder && startStopOrder >= destinationStopOrder) {
      setError("Başlangıç durağı, bitiş durağından önce olmalıdır")
      return
    }

    // Ek sefer ekle - destinationStopId kullanarak
    addExtraBus({
      frequency: Number(frequency),
      startTime,
      startStopId: Number(startStopId),
      destinationStopId: Number(destinationStopId), // endStopId yerine destinationStopId kullan
      capacity: Number(capacity),
    })

    // Başarı mesajı göster
    const startStopName = stops.find((s) => s.id === Number(startStopId))?.name
    const destinationStopName = stops.find((s) => s.id === Number(destinationStopId))?.name
    setSuccess(`Ek seferler eklendi: ${startStopName} - ${destinationStopName}, ${frequency} dk sıklıkla`)

    // Formu sıfırla
    setStartStopId("")
    setDestinationStopId("")
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="start-time-extra">Başlangıç Saati</Label>
        <Input id="start-time-extra" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="frequency">Sefer Sıklığı (dakika)</Label>
        <Input
          id="frequency"
          type="number"
          min="5"
          max="60"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="capacity">Otobüs Kapasitesi</Label>
        <Input
          id="capacity"
          type="number"
          min="10"
          max="100"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start-stop">Başlangıç Durağı</Label>
          <Select value={startStopId} onValueChange={setStartStopId}>
            <SelectTrigger id="start-stop">
              <SelectValue placeholder="Durak seçin" />
            </SelectTrigger>
            <SelectContent>
              {stops.map((stop) => (
                <SelectItem key={stop.id} value={stop.id.toString()}>
                  {stop.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="destination-stop">Bitiş Durağı</Label>
          <Select value={destinationStopId} onValueChange={setDestinationStopId}>
            <SelectTrigger id="destination-stop">
              <SelectValue placeholder="Durak seçin" />
            </SelectTrigger>
            <SelectContent>
              {stops.map((stop) => (
                <SelectItem key={stop.id} value={stop.id.toString()}>
                  {stop.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {success && <p className="text-sm text-green-500 font-medium">{success}</p>}

      <Button onClick={handleAddExtraBus} className="w-full bg-black hover:bg-gray-800">
        <Plus className="mr-2 h-4 w-4" /> Ek Sefer Ekle
      </Button>
    </div>
  )
}

// 4 aşamalı hız sistemi
const SPEED_STAGES = [
  { id: 1, label: "1x", value: 1, description: "Normal Hız", color: "bg-green-100 border-green-300" },
  { id: 2, label: "50x", value: 50, description: "Hızlı", color: "bg-yellow-100 border-yellow-300" },
  { id: 3, label: "100x", value: 100, description: "Çok Hızlı", color: "bg-orange-100 border-orange-300" },
  { id: 4, label: "MAX", value: 9999, description: "Maksimum Hız", color: "bg-red-100 border-red-300" },
]

// SimulationControl bileşenini güncelle
export default function SimulationControl() {
  const {
    isRunning,
    isPaused,
    isCompleted,
    currentTime,
    startSimulation,
    pauseSimulation,
    resetSimulation,
    stepSimulation,
    setSimulationParams,
    simulationParams,
    stops,
    passengers,
    buses,
    resetToDefaultData,
  } = useSimulation()

  const [startTime, setStartTime] = useState("07:00")
  const [duration, setDuration] = useState("60")
  const [speedStage, setSpeedStage] = useState(1) // 1-4 arası aşama
  const [repeat, setRepeat] = useState(false)
  const [progress, setProgress] = useState(0)

  // Simülasyon ilerleme durumunu hesapla
  useEffect(() => {
    if (!simulationParams) return

    const start = dayjs(`2023-01-01 ${simulationParams.startTime}:00`)
    const end = start.add(simulationParams.duration, "minute")
    const current = dayjs(`2023-01-01 ${currentTime}`)

    const totalDuration = end.diff(start, "minute")
    const elapsed = current.diff(start, "minute")

    const calculatedProgress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100))
    setProgress(calculatedProgress)
  }, [currentTime, simulationParams])

  // Simülasyonu başlat
  const handleStartSimulation = () => {
    // Eğer duraklatılmışsa, kaldığı yerden devam et
    if (isPaused) {
      // Duraklatılmış simülasyonu devam ettirirken parametreleri değiştirme
      startSimulation()
      return
    }

    // Seçilen aşamaya göre hızı belirle
    const selectedStage = SPEED_STAGES.find((stage) => stage.id === speedStage)
    const speed = selectedStage ? selectedStage.value : 1

    // Önce ayarları uygula (yeni simülasyon için reset ile)
    setSimulationParams({
      startTime,
      duration: Number.parseInt(duration),
      speed: speed,
      repeat,
    })

    // Simülasyonu başlatmadan önce konsola mevcut verileri yazdır
    console.log("Simülasyon başlatılıyor - Durak sayısı:", stops.length)
    console.log("Simülasyon başlatılıyor - Yolcu sayısı:", passengers.length)
    console.log("Simülasyon başlatılıyor - Otobüs sayısı:", buses.length)
    console.log("Simülasyon başlatılıyor - Hız aşaması:", speedStage, "- Hız:", speed)

    // Sonra simülasyonu başlat
    setTimeout(() => {
      startSimulation()
    }, 100)
  }

  // Simülasyonu duraklat
  const handlePauseSimulation = () => {
    pauseSimulation()
  }

  // Simülasyonu durdur (tamamen sıfırla)
  const handleStopSimulation = () => {
    resetSimulation()
  }

  // Simülasyon ayarlarını sıfırla
  const handleResetSettings = () => {
    setStartTime("07:00")
    setDuration("60")
    setSpeedStage(1)
    setRepeat(false)

    // Ayarları uygula
    setSimulationParams({
      startTime: "07:00",
      duration: 60,
      speed: 1,
      repeat: false,
    })

    // Simülasyonu sıfırla ve ek seferleri kaldır
    resetToDefaultData()
  }

  // Hız aşamasını değiştir
  const handleSpeedStageChange = (newStage: number) => {
    setSpeedStage(newStage)

    // Eğer simülasyon çalışıyorsa veya duraklatılmışsa hızı anında güncelle
    if ((isRunning || isPaused) && simulationParams) {
      const selectedStage = SPEED_STAGES.find((stage) => stage.id === newStage)
      const speed = selectedStage ? selectedStage.value : 1

      setSimulationParams({
        ...simulationParams,
        speed: speed,
      })
    }
  }

  const currentStage = SPEED_STAGES.find((stage) => stage.id === speedStage) || SPEED_STAGES[0]

  return (
    <div className="space-y-4">
      {/* Mevcut simülasyon kontrolleri */}
      <div className="space-y-2">
        <Label htmlFor="start-time">Başlangıç Saati</Label>
        <Input
          id="start-time"
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          disabled={isRunning || isPaused}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="duration">Simülasyon Süresi (dakika)</Label>
        <Input
          id="duration"
          type="number"
          min="1"
          max="120"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          disabled={isRunning || isPaused}
        />
      </div>

      {/* 4 Aşamalı Hız Sistemi */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Simülasyon Hızı</Label>
          <Badge variant="outline" className={currentStage.color}>
            {currentStage.label} - {currentStage.description}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {SPEED_STAGES.map((stage) => (
            <Button
              key={stage.id}
              variant="outline"
              size="sm"
              onClick={() => handleSpeedStageChange(stage.id)}
              className={`${speedStage === stage.id ? stage.color : ""} transition-all duration-200`}
            >
              {stage.id === 4 && <Zap className="mr-1 h-3 w-3" />}
              {stage.label}
              <span className="ml-1 text-xs opacity-70">{stage.description}</span>
            </Button>
          ))}
        </div>

        {/* Maksimum hız için uyarı */}
        {speedStage === 4 && (
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
            <div className="flex items-start">
              <Zap className="h-4 w-4 text-amber-600 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Maksimum Hız Modu</p>
                <p className="text-xs mt-1">
                  Simülasyon olaylar arasında maksimum hızda atlayacak. Tüm loglar 1 saniye aralıklarla kaydedilecek ve
                  sonuçlarda görüntülenecek.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Switch id="repeat" checked={repeat} onCheckedChange={setRepeat} disabled={isRunning || isPaused} />
        <Label htmlFor="repeat">Simülasyonu Tekrarla</Label>
      </div>

      {/* Simülasyon ilerleme çubuğu */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span>{simulationParams?.startTime || "07:00"}:00</span>
          <span>
            {simulationParams
              ? dayjs(`2023-01-01 ${simulationParams.startTime}:00`)
                  .add(simulationParams.duration, "minute")
                  .format("HH:mm:ss")
              : "08:00:00"}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Başlangıç</span>
          <span>İlerleme: %{Math.round(progress)}</span>
          <span>Bitiş</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-4">
        <div className="col-span-2 flex space-x-2">
          {/* Başlat/Devam Et butonu */}
          {!isRunning && (
            <Button
              onClick={handleStartSimulation}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-md"
            >
              <Play className="mr-2 h-4 w-4" />
              {isPaused ? "Devam Et" : isCompleted ? "Yeniden Başlat" : "Başlat"}
              {speedStage === 4 && <Zap className="ml-2 h-4 w-4" />}
            </Button>
          )}

          {/* Duraklat butonu */}
          {isRunning && (
            <Button
              onClick={handlePauseSimulation}
              className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl shadow-md"
            >
              <Pause className="mr-2 h-4 w-4" /> Duraklat
            </Button>
          )}

          {/* Durdur butonu */}
          <Button
            onClick={handleStopSimulation}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md"
          >
            <Square className="mr-2 h-4 w-4" /> Durdur
          </Button>
        </div>

        <div className="col-span-2 flex space-x-2">
          {/* Adım butonu */}
          <Button
            onClick={stepSimulation}
            variant="outline"
            disabled={isRunning}
            title="Adım İlerlet"
            className="flex-1 rounded-xl shadow-sm"
          >
            <StepForward className="mr-2 h-4 w-4" /> Adım İlerlet
          </Button>

          {/* Ayarları Sıfırla butonu */}
          <Button
            onClick={handleResetSettings}
            variant="outline"
            className="flex-1 rounded-xl shadow-sm"
            title="Ayarları Sıfırla"
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Ayarları Sıfırla
          </Button>
        </div>
      </div>

      {/* Ek Sefer Oluşturma Bölümü */}
      <Accordion type="single" collapsible className="mt-6">
        <AccordionItem value="extra-bus">
          <AccordionTrigger className="py-2">
            <div className="flex items-center">
              <Bus className="mr-2 h-4 w-4" />
              <span>Ek Sefer Oluştur</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ExtraBusForm />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
