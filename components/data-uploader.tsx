"use client"

import type React from "react"
import type { Stop, Passenger, Bus } from "@/context/simulation-context"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useSimulation } from "@/context/simulation-context"
import { Upload, Users, MapPin, Info, CheckCircle, XCircle, FileSpreadsheet, FileText, BusIcon } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import * as XLSX from "xlsx"

// CSV dosyasını okumak için yardımcı fonksiyon
const parseCSV = (text: string): string[][] => {
  const lines = text.split("\n").filter((line) => line.trim() !== "")
  return lines.map((line) => line.split(",").map((value) => value.trim()))
}

// Excel dosyasını okumak için yardımcı fonksiyon
const parseExcel = (buffer: ArrayBuffer): string[][] => {
  const workbook = XLSX.read(buffer, { type: "array" })
  const firstSheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[firstSheetName]
  const data = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 })
  return data
}

// Excel'den gelen zaman değerlerini HH:MM:SS formatına dönüştüren yardımcı fonksiyon
const convertExcelTimeToHHMMSS = (excelTime: string | number): string => {
  // Eğer zaten HH:MM:SS formatındaysa doğrudan döndür
  if (typeof excelTime === "string" && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(excelTime)) {
    return excelTime
  }

  // Eğer HH:MM formatındaysa saniye ekleyerek döndür
  if (typeof excelTime === "string" && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(excelTime)) {
    return `${excelTime}:00`
  }

  try {
    // Excel'in ondalık zaman formatını (günün kesri) HH:MM:SS formatına dönüştür
    const totalSeconds = Math.round(Number(excelTime) * 24 * 60 * 60)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  } catch (error) {
    // Dönüştürme başarısız olursa orijinal değeri döndür
    return String(excelTime)
  }
}

// Durak verilerini doğrulama
const validateStopData = (data: any[]): { valid: boolean; stops: Stop[]; error?: string } => {
  try {
    if (data.length === 0) {
      return { valid: false, stops: [], error: "Dosya boş veya veri içermiyor." }
    }

    // Başlık satırını kontrol et (isteğe bağlı)
    const headerRow = data[0]
    const hasHeader = headerRow.some(
      (cell: string) =>
        typeof cell === "string" && ["id", "name", "order", "timetonext", "route_id"].includes(cell.toLowerCase()),
    )

    // Başlık satırı varsa atla
    const startIndex = hasHeader ? 1 : 0

    const stops: Stop[] = []

    for (let i = startIndex; i < data.length; i++) {
      const row = data[i]
      if (!row || row.length === 0) continue // Boş satırları atla
      if (row.length < 5) {
        return {
          valid: false,
          stops: [],
          error: `Satır ${i + 1}: Eksik veri. 5 sütun beklenirken ${row.length} sütun bulundu.`,
        }
      }

      const id = Number.parseInt(String(row[0]))
      const name = String(row[1])
      const order = Number.parseInt(String(row[2]))
      const timeToNextStr = String(row[3])
      const timeToNext = timeToNextStr.toLowerCase() === "null" ? null : Number.parseInt(timeToNextStr)
      const route_id = String(row[4] || "171") // Default to "171" if not provided

      if (isNaN(id)) {
        return { valid: false, stops: [], error: `Satır ${i + 1}: Geçersiz ID değeri: "${row[0]}"` }
      }
      if (!name || name.trim() === "") {
        return { valid: false, stops: [], error: `Satır ${i + 1}: Durak adı boş olamaz.` }
      }
      if (isNaN(order)) {
        return { valid: false, stops: [], error: `Satır ${i + 1}: Geçersiz sıra değeri: "${row[2]}"` }
      }
      if (timeToNextStr.toLowerCase() !== "null" && isNaN(timeToNext as number)) {
        return { valid: false, stops: [], error: `Satır ${i + 1}: Geçersiz timeToNext değeri: "${row[3]}"` }
      }

      stops.push({ id, name, order, timeToNext, route_id })
    }

    if (stops.length === 0) {
      return { valid: false, stops: [], error: "Geçerli durak verisi bulunamadı." }
    }

    return { valid: true, stops }
  } catch (error) {
    console.error("Durak verisi doğrulama hatası:", error)
    return {
      valid: false,
      stops: [],
      error: "Beklenmeyen bir hata oluştu: " + (error instanceof Error ? error.message : String(error)),
    }
  }
}

// Yolcu verilerini doğrulama fonksiyonunu güncelle
const validatePassengerData = (data: any[]): { valid: boolean; passengers: Passenger[]; error?: string } => {
  try {
    if (data.length === 0) {
      return { valid: false, passengers: [], error: "Dosya boş veya veri içermiyor." }
    }

    // Başlık satırını kontrol et (isteğe bağlı)
    const headerRow = data[0]
    const hasHeader = headerRow.some(
      (cell: string) =>
        typeof cell === "string" && ["id", "arrivaltime", "boardingstop", "alightingstop"].includes(cell.toLowerCase()),
    )

    // Başlık satırı varsa atla
    const startIndex = hasHeader ? 1 : 0

    const passengers: Passenger[] = []

    for (let i = startIndex; i < data.length; i++) {
      const row = data[i]
      if (!row || row.length === 0) continue // Boş satırları atla
      if (row.length < 4) {
        return {
          valid: false,
          passengers: [],
          error: `Satır ${i + 1}: Eksik veri. 4 sütun beklenirken ${row.length} sütun bulundu.`,
        }
      }

      const id = Number.parseInt(String(row[0]))
      // Excel zaman formatını HH:MM:SS formatına dönüştür
      const arrivalTime = convertExcelTimeToHHMMSS(row[1])
      const boardingStop = Number.parseInt(String(row[2]))
      const alightingStop = Number.parseInt(String(row[3]))

      // Zaman formatını kontrol et (HH:MM:SS)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/

      if (isNaN(id)) {
        return { valid: false, passengers: [], error: `Satır ${i + 1}: Geçersiz ID değeri: "${row[0]}"` }
      }
      if (!timeRegex.test(arrivalTime)) {
        return {
          valid: false,
          passengers: [],
          error: `Satır ${i + 1}: Geçersiz varış zamanı formatı: "${row[1]}" -> "${arrivalTime}". Beklenen format: HH:MM:SS`,
        }
      }
      if (isNaN(boardingStop)) {
        return { valid: false, passengers: [], error: `Satır ${i + 1}: Geçersiz biniş durağı değeri: "${row[2]}"` }
      }
      if (isNaN(alightingStop)) {
        return { valid: false, passengers: [], error: `Satır ${i + 1}: Geçersiz iniş durağı değeri: "${row[3]}"` }
      }
      if (boardingStop === alightingStop) {
        return {
          valid: false,
          passengers: [],
          error: `Satır ${i + 1}: Biniş ve iniş durakları aynı olamaz: ${boardingStop}`,
        }
      }

      passengers.push({ id, arrivalTime, boardingStop, alightingStop })
    }

    if (passengers.length === 0) {
      return { valid: false, passengers: [], error: "Geçerli yolcu verisi bulunamadı." }
    }

    return { valid: true, passengers }
  } catch (error) {
    console.error("Yolcu verisi doğrulama hatası:", error)
    return {
      valid: false,
      passengers: [],
      error: "Beklenmeyen bir hata oluştu: " + (error instanceof Error ? error.message : String(error)),
    }
  }
}

// Otobüs verilerini doğrulama fonksiyonunu güncelle
const validateBusData = (data: any[]): { valid: boolean; buses: Bus[]; error?: string } => {
  try {
    if (data.length === 0) {
      return { valid: false, buses: [], error: "Dosya boş veya veri içermiyor." }
    }

    // Başlık satırını kontrol et (isteğe bağlı)
    const headerRow = data[0]
    const hasHeader = headerRow.some(
      (cell: string) =>
        typeof cell === "string" &&
        ["bus_id", "capacity", "start_time", "start_location_stop_id", "route_id"].includes(cell.toLowerCase()),
    )

    // Başlık satırı varsa atla
    const startIndex = hasHeader ? 1 : 0

    const buses: Bus[] = []

    for (let i = startIndex; i < data.length; i++) {
      const row = data[i]
      if (!row || row.length === 0) continue // Boş satırları atla
      if (row.length < 5) {
        return {
          valid: false,
          buses: [],
          error: `Satır ${i + 1}: Eksik veri. 5 sütun beklenirken ${row.length} sütun bulundu.`,
        }
      }

      const id = Number.parseInt(String(row[0]))
      const capacity = Number.parseInt(String(row[1]))
      // Excel zaman formatını HH:MM formatına dönüştür
      let start_time = convertExcelTimeToHHMMSS(row[2])
      // HH:MM:SS formatından HH:MM formatına dönüştür
      if (start_time.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)) {
        start_time = start_time.substring(0, 5)
      }
      const start_location_stop_id = Number.parseInt(String(row[3]))
      const route_id = String(row[4] || "171") // Default to "171" if not provided

      // Zaman formatını kontrol et (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/

      if (isNaN(id)) {
        return { valid: false, buses: [], error: `Satır ${i + 1}: Geçersiz ID değeri: "${row[0]}"` }
      }
      if (isNaN(capacity) || capacity <= 0) {
        return { valid: false, buses: [], error: `Satır ${i + 1}: Geçersiz kapasite değeri: "${row[1]}"` }
      }
      if (!timeRegex.test(start_time)) {
        return {
          valid: false,
          buses: [],
          error: `Satır ${i + 1}: Geçersiz başlangıç zamanı formatı: "${row[2]}" -> "${start_time}". Beklenen format: HH:MM`,
        }
      }
      if (isNaN(start_location_stop_id)) {
        return { valid: false, buses: [], error: `Satır ${i + 1}: Geçersiz başlangıç durağı değeri: "${row[3]}"` }
      }

      buses.push({
        id,
        capacity,
        start_time,
        start_location_stop_id,
        route_id,
        status: "waiting",
        passengers: [],
      })
    }

    if (buses.length === 0) {
      return { valid: false, buses: [], error: "Geçerli otobüs verisi bulunamadı." }
    }

    return { valid: true, buses }
  } catch (error) {
    console.error("Otobüs verisi doğrulama hatası:", error)
    return {
      valid: false,
      buses: [],
      error: "Beklenmeyen bir hata oluştu: " + (error instanceof Error ? error.message : String(error)),
    }
  }
}

export default function DataUploader() {
  const {
    loadStopData,
    loadPassengerData,
    loadBusData,
    resetToDefaultData,
    resetSimulation,
    stops,
    passengers,
    buses,
  } = useSimulation()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState("stops")

  const [stopFile, setStopFile] = useState<File | null>(null)
  const [passengerFile, setPassengerFile] = useState<File | null>(null)
  const [busFile, setBusFile] = useState<File | null>(null)

  const [stopDataValid, setStopDataValid] = useState<boolean | null>(null)
  const [passengerDataValid, setPassengerDataValid] = useState<boolean | null>(null)
  const [busDataValid, setBusDataValid] = useState<boolean | null>(null)

  const [stopError, setStopError] = useState<string | null>(null)
  const [passengerError, setPassengerError] = useState<string | null>(null)
  const [busError, setBusError] = useState<string | null>(null)

  const [validatedStops, setValidatedStops] = useState<Stop[] | null>(null)
  const [validatedPassengers, setValidatedPassengers] = useState<Passenger[] | null>(null)
  const [validatedBuses, setValidatedBuses] = useState<Bus[] | null>(null)

  const stopInputRef = useRef<HTMLInputElement>(null)
  const passengerInputRef = useRef<HTMLInputElement>(null)
  const busInputRef = useRef<HTMLInputElement>(null)

  const handleStopFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      setStopFile(file)
      setStopError(null)

      // Dosya türünü kontrol et
      const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls")
      const isCSV = file.name.endsWith(".csv")

      if (!isExcel && !isCSV) {
        setStopDataValid(false)
        setStopError("Desteklenmeyen dosya formatı. Lütfen .csv, .xlsx veya .xls dosyası yükleyin.")
        toast({
          title: "Desteklenmeyen dosya formatı",
          description: "Lütfen .csv, .xlsx veya .xls dosyası yükleyin.",
          variant: "destructive",
        })
        return
      }

      // Dosyayı oku ve doğrula
      const reader = new FileReader()

      reader.onload = (event) => {
        if (event.target?.result) {
          try {
            let data: string[][]

            if (isExcel) {
              data = parseExcel(event.target.result as ArrayBuffer)
            } else {
              data = parseCSV(event.target.result as string)
            }

            const validationResult = validateStopData(data)

            setStopDataValid(validationResult.valid)
            if (validationResult.valid) {
              setValidatedStops(validationResult.stops)
              toast({
                title: "Durak dosyası doğrulandı",
                description: `${validationResult.stops.length} durak başarıyla doğrulandı.`,
              })
            } else {
              setStopError(validationResult.error || "Bilinmeyen doğrulama hatası")
              toast({
                title: "Durak dosyası geçersiz",
                description: validationResult.error || "Dosya formatı uygun değil. Lütfen örnek formatı kontrol edin.",
                variant: "destructive",
              })
            }
          } catch (error) {
            setStopDataValid(false)
            const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata"
            setStopError(`Dosya okuma hatası: ${errorMessage}`)
            toast({
              title: "Dosya okuma hatası",
              description: `Dosya okunurken bir hata oluştu: ${errorMessage}`,
              variant: "destructive",
            })
          }
        }
      }

      if (isExcel) {
        reader.readAsArrayBuffer(file)
      } else {
        reader.readAsText(file)
      }
    }
  }

  const handlePassengerFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      setPassengerFile(file)
      setPassengerError(null)

      // Dosya türünü kontrol et
      const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls")
      const isCSV = file.name.endsWith(".csv")

      if (!isExcel && !isCSV) {
        setPassengerDataValid(false)
        setPassengerError("Desteklenmeyen dosya formatı. Lütfen .csv, .xlsx veya .xls dosyası yükleyin.")
        toast({
          title: "Desteklenmeyen dosya formatı",
          description: "Lütfen .csv, .xlsx veya .xls dosyası yükleyin.",
          variant: "destructive",
        })
        return
      }

      // Dosyayı oku ve doğrula
      const reader = new FileReader()

      reader.onload = (event) => {
        if (event.target?.result) {
          try {
            let data: string[][]

            if (isExcel) {
              data = parseExcel(event.target.result as ArrayBuffer)
            } else {
              data = parseCSV(event.target.result as string)
            }

            const validationResult = validatePassengerData(data)

            setPassengerDataValid(validationResult.valid)
            if (validationResult.valid) {
              setValidatedPassengers(validationResult.passengers)
              toast({
                title: "Yolcu dosyası doğrulandı",
                description: `${validationResult.passengers.length} yolcu verisi başarıyla doğrulandı.`,
              })
            } else {
              setPassengerError(validationResult.error || "Bilinmeyen doğrulama hatası")
              toast({
                title: "Yolcu dosyası geçersiz",
                description: validationResult.error || "Dosya formatı uygun değil. Lütfen örnek formatı kontrol edin.",
                variant: "destructive",
              })
            }
          } catch (error) {
            setPassengerDataValid(false)
            const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata"
            setPassengerError(`Dosya okuma hatası: ${errorMessage}`)
            toast({
              title: "Dosya okuma hatası",
              description: `Dosya okunurken bir hata oluştu: ${errorMessage}`,
              variant: "destructive",
            })
          }
        }
      }

      if (isExcel) {
        reader.readAsArrayBuffer(file)
      } else {
        reader.readAsText(file)
      }
    }
  }

  const handleBusFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      setBusFile(file)
      setBusError(null)

      // Dosya türünü kontrol et
      const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls")
      const isCSV = file.name.endsWith(".csv")

      if (!isExcel && !isCSV) {
        setBusDataValid(false)
        setBusError("Desteklenmeyen dosya formatı. Lütfen .csv, .xlsx veya .xls dosyası yükleyin.")
        toast({
          title: "Desteklenmeyen dosya formatı",
          description: "Lütfen .csv, .xlsx veya .xls dosyası yükleyin.",
          variant: "destructive",
        })
        return
      }

      // Dosyayı oku ve doğrula
      const reader = new FileReader()

      reader.onload = (event) => {
        if (event.target?.result) {
          try {
            let data: string[][]

            if (isExcel) {
              data = parseExcel(event.target.result as ArrayBuffer)
            } else {
              data = parseCSV(event.target.result as string)
            }

            const validationResult = validateBusData(data)

            setBusDataValid(validationResult.valid)
            if (validationResult.valid) {
              setValidatedBuses(validationResult.buses)
              toast({
                title: "Otobüs dosyası doğrulandı",
                description: `${validationResult.buses.length} otobüs verisi başarıyla doğrulandı.`,
              })
            } else {
              setBusError(validationResult.error || "Bilinmeyen doğrulama hatası")
              toast({
                title: "Otobüs dosyası geçersiz",
                description: validationResult.error || "Dosya formatı uygun değil. Lütfen örnek formatı kontrol edin.",
                variant: "destructive",
              })
            }
          } catch (error) {
            setBusDataValid(false)
            const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata"
            setBusError(`Dosya okuma hatası: ${errorMessage}`)
            toast({
              title: "Dosya okuma hatası",
              description: `Dosya okunurken bir hata oluştu: ${errorMessage}`,
              variant: "destructive",
            })
          }
        }
      }

      if (isExcel) {
        reader.readAsArrayBuffer(file)
      } else {
        reader.readAsText(file)
      }
    }
  }

  // processFiles fonksiyonunu düzelt - durak, yolcu ve otobüs verilerini ayrı ayrı işle
  const processFiles = () => {
    // Durak verilerini yükle
    if (validatedStops && stopDataValid) {
      console.log("Durak verileri yükleniyor:", validatedStops)
      loadStopData(validatedStops)
      toast({
        title: "Durak verileri yüklendi",
        description: `${validatedStops.length} durak verisi simülasyona yüklendi.`,
      })

      // Durak dosya seçimini temizle
      if (stopInputRef.current) stopInputRef.current.value = ""
      setStopFile(null)
      setStopDataValid(null)
      setStopError(null)
      setValidatedStops(null)
    }

    // Yolcu verilerini yükle
    if (validatedPassengers && passengerDataValid) {
      console.log("Yolcu verileri yükleniyor:", validatedPassengers)
      loadPassengerData(validatedPassengers)
      toast({
        title: "Yolcu verileri yüklendi",
        description: `${validatedPassengers.length} yolcu verisi simülasyona yüklendi.`,
      })

      // Yolcu dosya seçimini temizle
      if (passengerInputRef.current) passengerInputRef.current.value = ""
      setPassengerFile(null)
      setPassengerDataValid(null)
      setPassengerError(null)
      setValidatedPassengers(null)
    }

    // Otobüs verilerini yükle
    if (validatedBuses && busDataValid) {
      console.log("Otobüs verileri yükleniyor:", validatedBuses)
      loadBusData(validatedBuses)
      toast({
        title: "Otobüs verileri yüklendi",
        description: `${validatedBuses.length} otobüs verisi simülasyona yüklendi.`,
      })

      // Otobüs dosya seçimini temizle
      if (busInputRef.current) busInputRef.current.value = ""
      setBusFile(null)
      setBusDataValid(null)
      setBusError(null)
      setValidatedBuses(null)
    }

    // Simülasyonu sıfırla
    resetSimulation()

    // Yükleme sonrası mevcut verileri kontrol et
    setTimeout(() => {
      console.log("Yükleme sonrası durak verileri:", stops)
      console.log("Yükleme sonrası yolcu verileri:", passengers)
      console.log("Yükleme sonrası otobüs verileri:", buses)
    }, 500)
  }

  const handleResetToDefaults = () => {
    resetToDefaultData()

    // Dosya seçimlerini temizle
    if (stopInputRef.current) stopInputRef.current.value = ""
    if (passengerInputRef.current) passengerInputRef.current.value = ""
    if (busInputRef.current) busInputRef.current.value = ""

    setStopFile(null)
    setPassengerFile(null)
    setBusFile(null)
    setStopDataValid(null)
    setPassengerDataValid(null)
    setBusDataValid(null)
    setStopError(null)
    setPassengerError(null)
    setBusError(null)
    setValidatedStops(null)
    setValidatedPassengers(null)
    setValidatedBuses(null)

    toast({
      title: "Varsayılan veriler yüklendi",
      description: "Tüm veriler varsayılan değerlere sıfırlandı.",
    })
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="stops" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Durak Verileri
          </TabsTrigger>
          <TabsTrigger value="passengers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Yolcu Verileri
          </TabsTrigger>
          <TabsTrigger value="buses" className="flex items-center gap-2">
            <BusIcon className="h-4 w-4" />
            Otobüs Verileri
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stops">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <div className="flex items-center">
                  <MapPin className="mr-2 h-4 w-4" />
                  Durak Verileri
                </div>
                {stopDataValid !== null &&
                  (stopDataValid ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ))}
              </CardTitle>
              <CardDescription className="text-xs">CSV veya Excel formatında durak verilerini yükleyin</CardDescription>
            </CardHeader>
            <CardContent className="py-2 space-y-3">
              <Alert variant="outline" className="py-2">
                <Info className="h-4 w-4" />
                <AlertTitle className="text-xs font-medium">Beklenen Sütun Formatı</AlertTitle>
                <AlertDescription className="text-xs">
                  <code>id, name, order, timeToNext, route_id</code>
                  <br />
                  Örnek: <code>1, A Durak, 1, 240, 171</code> {/* 4 dakika = 240 saniye */}
                </AlertDescription>
              </Alert>

              {stopError && (
                <Alert variant="destructive" className="py-2">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle className="text-xs font-medium">Hata</AlertTitle>
                  <AlertDescription className="text-xs">{stopError}</AlertDescription>
                </Alert>
              )}

              <div className="grid w-full items-center gap-1.5">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">.csv, .xlsx, .xls</span>
                </div>
                <Input
                  id="stop-file"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleStopFileUpload}
                  ref={stopInputRef}
                  className="bg-blue-50 border-2 border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer"
                />
                {stopFile && <p className="text-xs text-muted-foreground">{stopFile.name}</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="passengers">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="mr-2 h-4 w-4" />
                  Yolcu Verileri
                </div>
                {passengerDataValid !== null &&
                  (passengerDataValid ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ))}
              </CardTitle>
              <CardDescription className="text-xs">CSV veya Excel formatında yolcu verilerini yükleyin</CardDescription>
            </CardHeader>
            <CardContent className="py-2 space-y-3">
              <Alert variant="outline" className="py-2">
                <Info className="h-4 w-4" />
                <AlertTitle className="text-xs font-medium">Beklenen Sütun Formatı</AlertTitle>
                <AlertDescription className="text-xs">
                  <code>id, arrivalTime, boardingStop, alightingStop</code>
                  <br />
                  Örnek: <code>1, 07:01:00, 1, 2</code>
                </AlertDescription>
              </Alert>

              {passengerError && (
                <Alert variant="destructive" className="py-2">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle className="text-xs font-medium">Hata</AlertTitle>
                  <AlertDescription className="text-xs">{passengerError}</AlertDescription>
                </Alert>
              )}

              <div className="grid w-full items-center gap-1.5">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">.csv, .xlsx, .xls</span>
                </div>
                <Input
                  id="passenger-file"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handlePassengerFileUpload}
                  ref={passengerInputRef}
                  className="bg-blue-50 border-2 border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer"
                />
                {passengerFile && <p className="text-xs text-muted-foreground">{passengerFile.name}</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="buses">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <div className="flex items-center">
                  <BusIcon className="mr-2 h-4 w-4" />
                  Otobüs Verileri
                </div>
                {busDataValid !== null &&
                  (busDataValid ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ))}
              </CardTitle>
              <CardDescription className="text-xs">CSV veya Excel formatında otobüs verilerini</CardDescription>
            </CardHeader>
            <CardContent className="py-2 space-y-3">
              <Alert variant="outline" className="py-2">
                <Info className="h-4 w-4" />
                <AlertTitle className="text-xs font-medium">Beklenen Sütun Formatı</AlertTitle>
                <AlertDescription className="text-xs">
                  <code>bus_id, capacity, start_time, start_location_stop_id, route_id</code>
                  <br />
                  Örnek: <code>1, 3, 07:00, 1, 171</code>
                </AlertDescription>
              </Alert>

              {busError && (
                <Alert variant="destructive" className="py-2">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle className="text-xs font-medium">Hata</AlertTitle>
                  <AlertDescription className="text-xs">{busError}</AlertDescription>
                </Alert>
              )}

              <div className="grid w-full items-center gap-1.5">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">.csv, .xlsx, .xls</span>
                </div>
                <Input
                  id="bus-file"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleBusFileUpload}
                  ref={busInputRef}
                  className="bg-blue-50 border-2 border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer"
                />
                {busFile && <p className="text-xs text-muted-foreground">{busFile.name}</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex gap-2">
        <Button
          onClick={processFiles}
          className="flex-1"
          disabled={
            !(
              (stopDataValid && validatedStops) ||
              (passengerDataValid && validatedPassengers) ||
              (busDataValid && validatedBuses)
            )
          }
        >
          <Upload className="mr-2 h-4 w-4" /> Verileri Yükle
        </Button>
        <Button onClick={handleResetToDefaults} variant="outline" className="flex-1">
          Varsayılan Verileri Yükle
        </Button>
      </div>

      {/* Mevcut veri durumunu gösteren bilgi paneli */}
      <Alert variant="outline" className="mt-4">
        <Info className="h-4 w-4" />
        <AlertTitle className="text-xs font-medium">Mevcut Veriler</AlertTitle>
        <AlertDescription className="text-xs">
          <div className="flex justify-between mt-1">
            <span>Durak Sayısı:</span>
            <span className="font-medium">{stops.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Yolcu Sayısı:</span>
            <span className="font-medium">{passengers.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Otobüs Sayısı:</span>
            <span className="font-medium">{buses.length}</span>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}
