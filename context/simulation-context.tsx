"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useRef } from "react"
import { defaultStopData, defaultPassengerData, defaultBusData } from "@/lib/default-data"
// dayjs plugin'lerini ekle - dosyanın en üstüne
import dayjs from "dayjs"
import isSameOrBefore from "dayjs/plugin/isSameOrBefore"
import isSameOrAfter from "dayjs/plugin/isSameOrAfter"
import isBetween from "dayjs/plugin/isBetween"

// Plugin'leri yükle
dayjs.extend(isSameOrBefore)
dayjs.extend(isSameOrAfter)
dayjs.extend(isBetween)

// Types
export interface Stop {
  id: number
  name: string
  order: number
  timeToNext: number | null
  route_id: string
}

export interface Passenger {
  id: number
  arrivalTime: string
  boardingStop: number
  alightingStop: number
  status?: "waiting" | "onBus" | "arrived"
  boardedTime?: string
  arrivedTime?: string
  busId?: number // Hangi otobüse bindiği
  waitingOrder?: number // Durakta bekleme sırası
}

// Bus tipine isExtra alanını ekle
export interface Bus {
  id: number
  capacity: number
  start_time: string
  start_location_stop_id: number
  destination_location_stop_id?: number // Bitiş durağı - tüm otobüsler için kullanılacak
  route_id: string
  current_stop_id?: number
  next_stop_id?: number
  arrival_time?: string
  departure_time?: string
  completion_time?: string // Seferin tamamlandığı zaman
  status: "waiting" | "moving" | "completed"
  passengers: Passenger[]
  maxOccupancy: number // Sefer boyunca ulaşılan maksimum doluluk oranı
  isExtra?: boolean // Ek sefer olup olmadığını belirten alan
}

// Ek sefer verisi için yeni bir tip tanımla
export interface ExtraBusData {
  frequency: number
  startTime: string
  startStopId: number
  destinationStopId: number // endStopId yerine destinationStopId kullanılacak
  capacity: number
}

export interface SimulationParams {
  startTime: string
  duration: number
  speed: number
  repeat: boolean
}

interface PassengerHistoryEntry {
  time: string
  stopId: number
  waiting: number
  boarded: number
  alighted: number
}

interface BusEvent {
  time: string
  type: "arrival" | "departure"
  busId: number
  stopId: number
  processed?: boolean // İşlenip işlenmediğini takip etmek için yeni alan
}

interface SimulationLog {
  time: string
  message: string
}

// SimulationContextType içine ek sefer oluşturma fonksiyonunu ekle
interface SimulationContextType {
  isRunning: boolean
  isPaused: boolean
  currentTime: string
  stops: Stop[]
  passengers: Passenger[]
  waitingPassengers: Passenger[]
  buses: Bus[]
  passengerHistory: PassengerHistoryEntry[]
  simulationParams: SimulationParams
  isCompleted: boolean
  simulationLogs: SimulationLog[]
  startSimulation: () => void
  pauseSimulation: () => void
  resetSimulation: () => void
  stepSimulation: () => void
  setSimulationParams: (params: SimulationParams) => void
  loadStopData: (data: Stop[]) => void
  loadPassengerData: (data: Passenger[]) => void
  loadBusData: (data: Bus[]) => void
  resetToDefaultData: () => void
  addExtraBus: (extraBusData: ExtraBusData) => void // Yeni fonksiyon
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined)

export const SimulationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Core state
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [currentTime, setCurrentTime] = useState("07:00:00")
  const [stops, setStops] = useState<Stop[]>(defaultStopData)
  const [passengers, setPassengers] = useState<Passenger[]>(defaultPassengerData)
  const [waitingPassengers, setWaitingPassengers] = useState<Passenger[]>([])
  const [buses, setBuses] = useState<Bus[]>(defaultBusData)
  const [passengerHistory, setPassengerHistory] = useState<PassengerHistoryEntry[]>([])
  // Simülasyon loglarını ekle
  const [simulationLogs, setSimulationLogs] = useState<SimulationLog[]>([])
  // Simülasyon parametrelerinin varsayılan değerlerini güncelle
  const [simulationParams, setSimulationParams] = useState<SimulationParams>({
    startTime: "07:00",
    duration: 60,
    speed: 1, // 1x speed (normal speed)
    repeat: false,
  })

  // Refs for values that shouldn't trigger re-renders
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef("07:00:00")
  const endTimeRef = useRef("08:00:00")
  const lastUpdateTimeRef = useRef("")
  const isProcessingRef = useRef(false)
  const processedTimesRef = useRef<Set<string>>(new Set())
  const eventsQueueRef = useRef<BusEvent[]>([])
  // Yüklenen verileri takip etmek için yeni ref
  const originalPassengersRef = useRef<Passenger[]>(defaultPassengerData)
  const originalBusesRef = useRef<Bus[]>(defaultBusData)
  // Varsayılan otobüs verilerini saklamak için yeni ref
  const defaultBusesRef = useRef<Bus[]>(defaultBusData)
  // İşlenen olayları takip etmek için yeni ref
  const processedEventsRef = useRef<Set<string>>(new Set())
  // İşlenen yolcuları takip etmek için yeni ref
  const processedPassengersRef = useRef<Set<number>>(new Set())

  // Simülasyon logu eklemek için yardımcı fonksiyon
  const addSimulationLog = (message: string) => {
    // Aynı mesajın tekrarını önle
    const logKey = `${currentTime}-${message}`
    if (processedEventsRef.current.has(logKey)) {
      return
    }

    processedEventsRef.current.add(logKey)

    setSimulationLogs((prevLogs) => {
      const newLog = {
        time: currentTime,
        message,
      }
      // Son 100 logu tut
      const updatedLogs = [...prevLogs, newLog].slice(-5000)
      return updatedLogs
    })
  }

  // Initialize simulation times when params change
  useEffect(() => {
    if (isRunning) return // Don't update times while running

    const startTime = simulationParams.startTime + ":00"
    startTimeRef.current = startTime

    const endTime = dayjs(`2023-01-01 ${startTime}`).add(simulationParams.duration, "minute").format("HH:mm:ss")
    endTimeRef.current = endTime

    setCurrentTime(startTime)
    setIsCompleted(false)
  }, [simulationParams, isRunning])

  // Simülasyon başlangıcında tüm yolcuları hazırla
  useEffect(() => {
    if (currentTime === startTimeRef.current && !isProcessingRef.current) {
      // Simülasyon başlangıcında, başlangıç zamanında durağa gelen yolcuları işle
      processCurrentTime()

      // Başlangıçta her durak için bir history kaydı oluştur
      const initialHistory: PassengerHistoryEntry[] = []
      stops.forEach((stop) => {
        // Garaj durağı için history oluşturma
        if (stop.order > 0) {
          initialHistory.push({
            time: currentTime,
            stopId: stop.id,
            waiting: waitingPassengers.filter((p) => p.boardingStop === stop.id).length,
            boarded: 0,
            alighted: 0,
          })
        }
      })

      if (initialHistory.length > 0) {
        setPassengerHistory(initialHistory)
      }
    }
  }, [currentTime, stops])

  // Pause simulation
  const pauseSimulation = () => {
    setIsRunning(false)
    setIsPaused(true)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    // Önemli: Simülasyonu durdururken isCompleted'i değiştirme
    // böylece kullanıcı tekrar başlat butonuna tıkladığında kaldığı yerden devam edebilir
  }

  // resetSimulation fonksiyonunu güncelle - yüklenen verileri koruyacak şekilde değiştir
  const resetSimulation = () => {
    // First pause
    pauseSimulation()

    // Then reset all state
    setCurrentTime(startTimeRef.current)
    setWaitingPassengers([])
    setPassengerHistory([])
    setIsCompleted(false)
    setIsPaused(false)
    // Simülasyon loglarını temizle
    setSimulationLogs([])
    // İşlenen olayları temizle
    processedEventsRef.current.clear()
    // İşlenen yolcuları temizle
    processedPassengersRef.current.clear()

    // Reset passenger statuses - but keep the loaded passenger data
    setPassengers(
      originalPassengersRef.current.map((p) => ({
        ...p,
        status: undefined,
        boardedTime: undefined,
        arrivedTime: undefined,
        busId: undefined,
        waitingOrder: undefined,
      })),
    )

    // Reset bus statuses - but keep the loaded bus data
    setBuses((prevBuses) => {
      const resetBuses = originalBusesRef.current.map((b) => ({
        ...b,
        current_stop_id: b.start_location_stop_id,
        next_stop_id: getNextStopId(b.start_location_stop_id, b),
        arrival_time: undefined,
        departure_time: undefined,
        completion_time: undefined, // Tamamlanma zamanını sıfırla
        status: "waiting",
        passengers: [],
        maxOccupancy: 0, // Maksimum doluluk oranını sıfırla
      }))

      console.log("Sıfırlama sonrası otobüsler:", resetBuses)
      return resetBuses
    })

    // Reset events queue
    eventsQueueRef.current = []

    // Olayları asenkron olarak başlat (state güncellemeleri tamamlandıktan sonra)
    setTimeout(() => {
      initializeEvents()
      console.log("Olaylar yeniden başlatıldı, toplam olay sayısı:", eventsQueueRef.current.length)
    }, 0)

    lastUpdateTimeRef.current = ""
    processedTimesRef.current = new Set()
  }

  // Bir sonraki durağı bul
  const getNextStopId = (currentStopId: number, bus?: Bus): number | undefined => {
    const currentStop = stops.find((s) => s.id === currentStopId)
    if (!currentStop) return undefined

    // Eğer otobüs verilmediyse veya bitiş durağı belirtilmemişse, normal rota takip edilir
    if (!bus || !bus.destination_location_stop_id) {
      // Normal rota: sıra numarasına göre bir sonraki durağı bul
      const nextStop = stops.find((s) => s.order === currentStop.order + 1 && s.route_id === currentStop.route_id)
      return nextStop?.id
    }

    // Eğer otobüs bitiş durağına ulaştıysa, daha fazla gitmemesi gerekir
    if (currentStopId === bus.destination_location_stop_id) {
      return undefined
    }

    // Bitiş durağını ve mevcut durağı bulalım
    const destinationStop = stops.find((s) => s.id === bus.destination_location_stop_id)

    // Eğer bitiş durağı bulunamazsa, normal rotayı takip et
    if (!destinationStop) {
      const nextStop = stops.find((s) => s.order === currentStop.order + 1 && s.route_id === currentStop.route_id)
      return nextStop?.id
    }

    // Bitiş durağına doğru ilerleme: Bir sonraki durağı bul
    if (currentStop.order < destinationStop.order) {
      // Normal ilerleme: Bir sonraki durağa git
      const nextStop = stops.find((s) => s.order === currentStop.order + 1 && s.route_id === currentStop.route_id)
      return nextStop?.id
    } else {
      // Bitiş durağına ulaşıldı veya geçildi, daha fazla gitme
      return undefined
    }
  }

  // Duraklar arası seyahat süresini hesapla
  const getTravelTime = (fromStopId: number): number => {
    const fromStop = stops.find((s) => s.id === fromStopId)
    if (!fromStop || fromStop.timeToNext === null) {
      return 300 // Varsayılan olarak 300 saniye (5 dakika)
    }
    return fromStop.timeToNext // Durak verisindeki timeToNext değerini kullan (artık saniye cinsinden)
  }

  // Olayları başlat
  const initializeEvents = () => {
    // Mevcut kuyruk temizlenir
    eventsQueueRef.current = []
    const events: BusEvent[] = []

    // Tüm otobüsler için olayları oluştur
    buses.forEach((bus) => {
      console.log(`Otobüs #${bus.id} için olay oluşturuluyor:`, {
        startTime: bus.start_time,
        startStopId: bus.start_location_stop_id,
        destinationStopId: bus.destination_location_stop_id,
        isExtra: bus.isExtra,
      })

      // Başlangıç zamanını doğru formata getir
      let busStartTime = bus.start_time
      if (!busStartTime.includes(":")) {
        busStartTime = `${busStartTime}:00`
      }
      // Saniyeler eklenmemiş ise ekle
      if (busStartTime.split(":").length === 2) {
        busStartTime = `${busStartTime}:00`
      }

      // Simülasyon başlangıç zamanı
      const simStartTime = startTimeRef.current
      const busStartDayjs = dayjs(`2023-01-01 ${busStartTime}`)
      const simStartDayjs = dayjs(`2023-01-01 ${simStartTime}`)

      // Otobüs başlangıç zamanı simülasyon başlangıcından önceyse ayarla
      if (busStartDayjs.isBefore(simStartDayjs)) {
        console.log(
          `Otobüs #${bus.id} simülasyon başlangıcından önce (${busStartTime}), simülasyon başlangıcında başlatılacak (${simStartTime})`,
        )
        busStartTime = simStartTime
      }

      // Başlangıç durağından hareket olayı
      events.push({
        time: busStartTime,
        type: "departure",
        busId: bus.id,
        stopId: bus.start_location_stop_id,
      })

      // Bir sonraki durağa varış olayını hesapla
      const nextStopId = getNextStopId(bus.start_location_stop_id, bus)
      if (nextStopId) {
        const travelTime = getTravelTime(bus.start_location_stop_id)
        const arrivalTime = dayjs(`2023-01-01 ${busStartTime}`).add(travelTime, "second").format("HH:mm:ss")

        events.push({
          time: arrivalTime,
          type: "arrival",
          busId: bus.id,
          stopId: nextStopId,
        })
      } else {
        console.log(`Otobüs #${bus.id} için bir sonraki durak bulunamadı!`)
      }
    })

    // Olayları zamana göre sırala
    events.sort((a, b) => {
      return dayjs(`2023-01-01 ${a.time}`).diff(dayjs(`2023-01-01 ${b.time}`))
    })

    // Debug için olayları logla
    console.log(`Toplam ${events.length} olay oluşturuldu:`, events)
    eventsQueueRef.current = events
  }

  // Yeni bir olay ekle
  const addEvent = (event: BusEvent) => {
    // Olayı kuyruğa ekle
    eventsQueueRef.current.push(event)

    // Olayları zamana göre sırala
    eventsQueueRef.current.sort((a, b) => {
      return dayjs(`2023-01-01 ${a.time}`).diff(dayjs(`2023-01-01 ${b.time}`))
    })
  }

  // Otobüs olaylarını işle
  const processBusEvents = () => {
    const currentDayjs = dayjs(`2023-01-01 ${currentTime}`)
    const events = [...eventsQueueRef.current]

    // Şu anki zamana kadar olan olayları işle, ancak tamamlanmış otobüsler için olay işleme
    const eventsToProcess = events.filter((event) => {
      if (event.processed) return false

      // Otobüsün durumunu kontrol et
      const bus = buses.find((b) => b.id === event.busId)
      if (bus && bus.status === "completed") {
        console.log(`Otobüs #${event.busId} tamamlanmış, olay atlanıyor: ${event.type} at ${event.time}`)
        return false
      }

      return dayjs(`2023-01-01 ${event.time}`).isSameOrBefore(currentDayjs)
    })

    if (eventsToProcess.length === 0) return

    // İşlenecek olayları işaretleyerek kuyruktan çıkar
    eventsQueueRef.current = events
      .map((event) => {
        if (
          eventsToProcess.some(
            (e) =>
              e.busId === event.busId && e.stopId === event.stopId && e.time === event.time && e.type === event.type,
          )
        ) {
          return { ...event, processed: true }
        }
        return event
      })
      .filter((event) => !event.processed)

    // Olayları işle
    eventsToProcess.forEach((event) => {
      if (event.type === "arrival") {
        handleBusArrival(event)
      } else if (event.type === "departure") {
        handleBusDeparture(event)
      }
    })
  }

  // Otobüs varış olayını işle
  const handleBusArrival = (event: BusEvent) => {
    // Olay anahtarı oluştur
    const eventKey = `arrival-${event.busId}-${event.stopId}-${event.time}`

    // Bu olay daha önce işlendiyse atla
    if (processedEventsRef.current.has(eventKey)) {
      return
    }

    processedEventsRef.current.add(eventKey)

    // Durağı bul
    const stop = stops.find((s) => s.id === event.stopId)
    if (!stop) return

    // Durağın adını bul
    const stopName = stop.name

    // Simülasyon logu ekle
    const bus = buses.find((b) => b.id === event.busId)
    if (bus) {
      addSimulationLog(
        `#${event.busId} nolu otobüs ${stopName} durağına vardı (${bus.passengers.length}/${bus.capacity} yolcu)`,
      )
    }

    // Otobüsü güncelle
    setBuses((prevBuses) => {
      return prevBuses.map((b) => {
        if (b.id === event.busId) {
          return {
            ...b,
            current_stop_id: event.stopId,
            next_stop_id: getNextStopId(event.stopId, b),
            arrival_time: event.time,
            status: "waiting",
          }
        }
        return b
      })
    })

    // Garaj durağı değilse yolcu işlemlerini yap
    if (stop && stop.order > 0) {
      handlePassengerOperations(event.busId, event.stopId, event.time)
    }

    // Bir sonraki durağa hareket olayını oluştur (60 saniye sonra - 1 dakika dwell time)
    const departureTime = dayjs(`2023-01-01 ${event.time}`).add(1, "second").format("HH:mm:ss")

    addEvent({
      time: departureTime,
      type: "departure",
      busId: event.busId,
      stopId: event.stopId,
    })
  }

  // Otobüs kalkış olayını işle - handleBusDeparture fonksiyonunu güncelleyelim
  const handleBusDeparture = (event: BusEvent) => {
    // Olay anahtarı oluştur
    const eventKey = `departure-${event.busId}-${event.stopId}-${event.time}`

    // Bu olay daha önce işlendiyse atla
    if (processedEventsRef.current.has(eventKey)) {
      return
    }

    // Olayı işlenmiş olarak işaretle
    processedEventsRef.current.add(eventKey)

    console.log(`Otobüs #${event.busId} duraktan ayrıldı: ${event.stopId} - Zaman: ${event.time}`)

    // Otobüsü bul
    const bus = buses.find((b) => b.id === event.busId)
    if (!bus) {
      console.error(`Otobüs #${event.busId} bulunamadı!`)
      return
    }

    // Eğer otobüs zaten tamamlandıysa, yeni olay oluşturma
    if (bus.status === "completed") {
      console.log(`Otobüs #${event.busId} zaten tamamlanmış, yeni olay oluşturulmuyor`)
      return
    }

    const currentPassengerCount = bus.passengers.length

    // Durağın adını bul
    const stopId = event.stopId
    const stop = stops.find((s) => s.id === stopId)
    const stopName = stop ? stop.name : `#${stopId}`

    // Simülasyon logu ekle
    addSimulationLog(
      `#${event.busId} nolu otobüs ${stopName} durağından ayrıldı (${currentPassengerCount}/${bus.capacity || 0} yolcu)`,
    )

    // Bir sonraki durağı kontrol et (otobüs nesnesini de geçirerek)
    const nextStopId = getNextStopId(event.stopId, bus)

    // Eğer bir sonraki durak yoksa, otobüs tamamlandı
    if (!nextStopId) {
      addSimulationLog(`#${bus.id} nolu otobüs seferini tamamladı (${bus.passengers.length}/${bus.capacity} yolcu)`)

      // Otobüsü güncelle - COMPLETED olarak işaretle
      setBuses((prevBuses) => {
        return prevBuses.map((b) => {
          if (b.id === event.busId) {
            return {
              ...b,
              departure_time: event.time,
              completion_time: event.time, // Tamamlanma zamanını kaydet
              status: "completed",
            }
          }
          return b
        })
      })
      return // ÖNEMLİ: Burada return yaparak yeni olay oluşturulmasını engelle
    }

    // Bir sonraki durağa varış zamanını hesapla
    const travelTime = getTravelTime(event.stopId)
    // Travel time is already in seconds, so use it directly
    const arrivalTime = dayjs(`2023-01-01 ${event.time}`).add(travelTime, "second").format("HH:mm:ss")

    // Debug için log ekle
    console.log(
      `Otobüs #${event.busId}: ${stopName} (${event.stopId}) -> ${stops.find((s) => s.id === nextStopId)?.name} (${nextStopId}), Seyahat süresi: ${travelTime}s`,
    )

    // Bir sonraki durağa varış olayını oluştur
    addEvent({
      time: arrivalTime,
      type: "arrival",
      busId: event.busId,
      stopId: nextStopId,
    })

    // Otobüsü güncelle
    setBuses((prevBuses) => {
      return prevBuses.map((b) => {
        if (b.id === event.busId) {
          return {
            ...b,
            departure_time: event.time,
            status: "moving",
          }
        }
        return b
      })
    })
  }

  const handlePassengerOperations = (busId: number, stopId: number, time: string) => {
    // Otobüsü bul
    const bus = buses.find((b) => b.id === busId)
    if (!bus) return

    // Durağın adını bul
    const stop = stops.find((s) => s.id === stopId)
    const stopName = stop ? stop.name : `#${stopId}`

    // 1. İnecek yolcuları bul
    const alightingPassengers = bus.passengers.filter((p) => p.alightingStop === stopId)

    // 2. Durakta bekleyen yolcuları bul
    const waitingAtStop = waitingPassengers.filter((p) => p.boardingStop === stopId)

    // 3. İnme işlemi sonrası yolcu sayısını hesapla
    const passengersAfterAlighting = bus.passengers.length - alightingPassengers.length

    // 4. Binebilecek yolcu sayısını hesapla
    const availableSeats = bus.capacity - passengersAfterAlighting

    // İnme işlemi
    if (alightingPassengers.length > 0) {
      console.log(`${alightingPassengers.length} yolcu otobüsten indi: Otobüs #${busId}, Durak #${stopId}`)

      addSimulationLog(
        `#${busId} nolu otobüs ${stopName} durağında ${alightingPassengers.length} yolcu indirdi (${passengersAfterAlighting}/${bus.capacity} yolcu)`,
      )

      // Yolcuları güncelle
      setPassengers((prevPassengers) => {
        return prevPassengers.map((passenger) => {
          const isAlighting = alightingPassengers.some((p) => p.id === passenger.id)
          if (isAlighting) {
            return {
              ...passenger,
              status: "arrived",
              arrivedTime: time,
            }
          }
          return passenger
        })
      })

      // Durak geçmişini güncelle
      setPassengerHistory((prevHistory) => {
        const existingEntry = prevHistory.find((entry) => entry.stopId === stopId && entry.time === time)

        if (existingEntry) {
          return prevHistory.map((entry) => {
            if (entry.stopId === stopId && entry.time === time) {
              return {
                ...entry,
                alighted: entry.alighted + alightingPassengers.length,
              }
            }
            return entry
          })
        } else {
          return [
            ...prevHistory,
            {
              time,
              stopId,
              waiting: waitingPassengers.filter((p) => p.boardingStop === stopId).length,
              boarded: 0,
              alighted: alightingPassengers.length,
            },
          ]
        }
      })
    }

    // Binme işlemi
    if (waitingAtStop.length > 0) {
      if (availableSeats <= 0) {
        console.log(`Otobüs #${busId} dolu, yolcu alamıyor.`)
        addSimulationLog(
          `#${busId} nolu otobüs ${stopName} durağında dolu olduğu için yolcu alamadı (${passengersAfterAlighting}/${bus.capacity} yolcu)`,
        )
      } else {
        // Ek sefer ise veya varış durağı belirtilmiş ise, sadece belirli duraklar arasındaki yolcuları al
        let eligiblePassengers = [...waitingAtStop]
        if (bus.destination_location_stop_id) {
          // Bitiş durağını bul
          const destinationStop = stops.find((s) => s.id === bus.destination_location_stop_id)
          if (destinationStop) {
            // Sadece bitiş durağına kadar gidecek yolcuları al
            eligiblePassengers = waitingAtStop.filter((p) => {
              const alightingStop = stops.find((s) => s.id === p.alightingStop)
              return alightingStop && alightingStop.order <= destinationStop.order
            })
          }
        }

        if (eligiblePassengers.length > 0) {
          // Sıraya göre yolcuları al
          const sortedWaiting = [...eligiblePassengers].sort((a, b) => {
            // Önce varış zamanına göre sırala
            const timeA = dayjs(`2023-01-01 ${a.arrivalTime}`)
            const timeB = dayjs(`2023-01-01 ${b.arrivalTime}`)
            return timeA.diff(timeB)
          })

          // Kapasiteye göre yolcuları al
          const boardingPassengers = sortedWaiting.slice(0, availableSeats)

          if (boardingPassengers.length > 0) {
            console.log(`${boardingPassengers.length} yolcu otobüse bindi: Otobüs #${busId}, Durak #${stopId}`)

            const finalPassengerCount = passengersAfterAlighting + boardingPassengers.length
            addSimulationLog(
              `#${busId} nolu otobüs ${stopName} durağında ${boardingPassengers.length} yolcu aldı (${finalPassengerCount}/${bus.capacity} yolcu)`,
            )

            // Eğer durakta daha fazla bekleyen yolcu varsa ve otobüs doluysa ek log ekle
            if (waitingAtStop.length > boardingPassengers.length && finalPassengerCount >= bus.capacity) {
              addSimulationLog(
                `#${busId} nolu otobüs ${stopName} durağında kapasitesi dolduğu için ${waitingAtStop.length - boardingPassengers.length} yolcu alamadı`,
              )
            }

            // Yolcuları güncelle
            setPassengers((prevPassengers) => {
              return prevPassengers.map((passenger) => {
                const isBoarding = boardingPassengers.some((p) => p.id === passenger.id)
                if (isBoarding) {
                  return {
                    ...passenger,
                    status: "onBus",
                    boardedTime: time,
                    busId,
                  }
                }
                return passenger
              })
            })

            // Bekleyen yolcuları güncelle
            setWaitingPassengers((prevWaiting) => {
              return prevWaiting.filter((p) => !boardingPassengers.some((bp) => bp.id === p.id))
            })

            // Durak geçmişini güncelle
            setPassengerHistory((prevHistory) => {
              const existingEntry = prevHistory.find((entry) => entry.stopId === stopId && entry.time === time)

              if (existingEntry) {
                return prevHistory.map((entry) => {
                  if (entry.stopId === stopId && entry.time === time) {
                    return {
                      ...entry,
                      boarded: entry.boarded + boardingPassengers.length,
                      waiting: waitingAtStop.length - boardingPassengers.length,
                    }
                  }
                  return entry
                })
              } else {
                return [
                  ...prevHistory,
                  {
                    time,
                    stopId,
                    waiting: waitingAtStop.length - boardingPassengers.length,
                    boarded: boardingPassengers.length,
                    alighted: alightingPassengers.length,
                  },
                ]
              }
            })
          }
        }
      }
    }

    // Otobüsü güncelle - hem inme hem binme işlemlerini birlikte uygula
    setBuses((prevBuses) => {
      return prevBuses.map((b) => {
        if (b.id === busId) {
          // İnecek yolcuları çıkar
          let updatedPassengers = b.passengers.filter((p) => p.alightingStop !== stopId)

          // Binecek yolcuları ekle
          if (waitingAtStop.length > 0 && availableSeats > 0) {
            let eligiblePassengers = [...waitingAtStop]
            if (b.destination_location_stop_id) {
              const destinationStop = stops.find((s) => s.id === b.destination_location_stop_id)
              if (destinationStop) {
                eligiblePassengers = waitingAtStop.filter((p) => {
                  const alightingStop = stops.find((s) => s.id === p.alightingStop)
                  return alightingStop && alightingStop.order <= destinationStop.order
                })
              }
            }

            if (eligiblePassengers.length > 0) {
              const sortedWaiting = [...eligiblePassengers].sort((a, b) => {
                const timeA = dayjs(`2023-01-01 ${a.arrivalTime}`)
                const timeB = dayjs(`2023-01-01 ${b.arrivalTime}`)
                return timeA.diff(timeB)
              })

              const boardingPassengers = sortedWaiting.slice(0, availableSeats)
              updatedPassengers = [...updatedPassengers, ...boardingPassengers]
            }
          }

          const newOccupancyRate = (updatedPassengers.length / b.capacity) * 100

          return {
            ...b,
            passengers: updatedPassengers,
            maxOccupancy: Math.max(b.maxOccupancy || 0, newOccupancyRate),
          }
        }
        return b
      })
    })
  }

  // processCurrentTime fonksiyonunu güncelle - yolcuların durağa gelişlerini doğru şekilde işle
  const processCurrentTime = () => {
    if (isProcessingRef.current) return

    // Eğer bu zaman daha önce işlendiyse tekrar işleme
    if (processedTimesRef.current.has(currentTime)) return

    isProcessingRef.current = true

    try {
      // Bu zamanı işlenmiş olarak işaretle
      processedTimesRef.current.add(currentTime)

      // Şu anki simülasyon zamanı
      const currentDayjs = dayjs(`2023-01-01 ${currentTime}`)

      // Bir önceki simülasyon zamanı (veya başlangıç zamanı)
      const lastTime = lastUpdateTimeRef.current || startTimeRef.current
      const lastDayjs = dayjs(`2023-01-01 ${lastTime}`)

      // Tüm yolcuları kontrol et ve durağa gelenleri işaretle
      setPassengers((prevPassengers) => {
        return prevPassengers.map((passenger) => {
          // Eğer yolcu zaten işlendiyse (bir durumda ise) atla
          if (passenger.status) return passenger

          // Yolcunun varış zamanını kontrol et
          const arrivalDayjs = dayjs(`2023-01-01 ${passenger.arrivalTime}`)

          // Eğer yolcu şu anki zamanda veya daha önce geldiyse
          if (arrivalDayjs.isSameOrBefore(currentDayjs)) {
            // Yolcuyu işlenmiş olarak işaretle
            processedPassengersRef.current.add(passenger.id)

            // Yolcuyu "waiting" durumuna getir
            return {
              ...passenger,
              status: "waiting",
            }
          }

          return passenger
        })
      })

      // Bu zaman aralığında gelen yolcuları bul (son zamandan şimdiki zamana kadar)
      const arrivingPassengers = passengers.filter(
        (p) =>
          !p.status &&
          dayjs(`2023-01-01 ${p.arrivalTime}`).isAfter(lastDayjs) &&
          dayjs(`2023-01-01 ${p.arrivalTime}`).isSameOrBefore(currentDayjs),
      )

      if (arrivingPassengers.length > 0) {
        console.log(`${arrivingPassengers.length} yolcu geldi: ${lastTime} - ${currentTime} arasında`)

        // Yeni gelen yolcuları bekleyen yolculara ekle
        const newWaiting = [...waitingPassengers]

        arrivingPassengers.forEach((passenger) => {
          // Eğer yolcu zaten bekleyen yolcular listesinde değilse ekle
          if (!newWaiting.some((p) => p.id === passenger.id)) {
            newWaiting.push({
              ...passenger,
              status: "waiting",
              waitingOrder: newWaiting.filter((p) => p.boardingStop === passenger.boardingStop).length + 1,
            })
          }
        })

        setWaitingPassengers(newWaiting)

        // Etkilenen duraklar için history güncelle
        const newHistory = [...passengerHistory]
        const affectedStops = new Set(arrivingPassengers.map((p) => p.boardingStop))

        stops.forEach((stop) => {
          // Garaj durağı için history oluşturma
          if (stop.order > 0 && affectedStops.has(stop.id)) {
            newHistory.push({
              time: currentTime,
              stopId: stop.id,
              waiting: newWaiting.filter((p) => p.boardingStop === stop.id).length,
              boarded: 0,
              alighted: 0,
            })

            // Simülasyon logu ekle
            const passengerCount = arrivingPassengers.filter((p) => p.boardingStop === stop.id).length
            if (passengerCount > 0) {
              addSimulationLog(`${stop.name} durağına ${passengerCount} yolcu geldi`)
            }
          }
        })

        setPassengerHistory(newHistory)
      }

      // Otobüs olaylarını işle
      processBusEvents()

      lastUpdateTimeRef.current = currentTime
    } finally {
      isProcessingRef.current = false
    }
  }

  // Simülasyon tamamlandığında bildirim gösterilmesi için isCompleted state'ini doğru şekilde güncelleyelim
  // Effect to process simulation when time changes
  useEffect(() => {
    if (isRunning || currentTime !== lastUpdateTimeRef.current) {
      processCurrentTime()
    }

    // Simülasyon tamamlandı mı kontrol et
    if (
      currentTime === endTimeRef.current ||
      dayjs(`2023-01-01 ${currentTime}`).isAfter(dayjs(`2023-01-01 ${endTimeRef.current}`))
    ) {
      setIsCompleted(true)
      pauseSimulation()
      addSimulationLog("Simülasyon tamamlandı")
    }
  }, [currentTime, isRunning])

  // startSimulation fonksiyonunu güncelle - kaldığı yerden devam etmesi için
  const startSimulation = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    // Eğer simülasyon tamamlandıysa ve tekrar başlatılıyorsa sıfırla
    if (isCompleted && !simulationParams.repeat) {
      resetSimulation()
    }

    // Mevcut verileri kontrol et ve logla
    console.log("Simülasyon başlatılıyor - Durak sayısı:", stops.length)
    console.log("Simülasyon başlatılıyor - Yolcu sayısı:", passengers.length)
    console.log("Simülasyon başlatılıyor - Otobüs sayısı:", buses.length)

    // Olayları başlat
    if (eventsQueueRef.current.length === 0) {
      initializeEvents()
    }

    // Simülasyon başlangıcında, tüm yolcuların durumunu göster
    // Başlangıç zamanında veya daha önce gelen yolcuları "waiting" olarak işaretle
    const startTime = simulationParams.startTime + ":00"
    const startTimeDayjs = dayjs(`2023-01-01 ${startTime}`)

    // Eğer simülasyon ilk kez başlatılıyorsa (currentTime başlangıç zamanındaysa)
    if (currentTime === startTime) {
      // Başlangıç zamanında veya daha önce gelen yolcuları "waiting" olarak işaretle
      const initialWaiting = passengers
        .filter((p) => dayjs(`2023-01-01 ${p.arrivalTime}`).isSameOrBefore(startTimeDayjs) && !p.status)
        .map((p, index) => ({
          ...p,
          status: "waiting",
          waitingOrder: index + 1,
        }))

      if (initialWaiting.length > 0) {
        console.log(`Başlangıçta ${initialWaiting.length} yolcu bekliyor`)

        // Yolcuları güncelle
        setPassengers((prevPassengers) => {
          return prevPassengers.map((p) => {
            const isInitialWaiting = initialWaiting.some((w) => w.id === p.id)
            if (isInitialWaiting) {
              return {
                ...p,
                status: "waiting",
              }
            }
            return p
          })
        })

        // Bekleyen yolcuları güncelle
        setWaitingPassengers((prev) => {
          // Yeni bekleyen yolcuları ekle, ancak zaten bekleyenleri tekrar ekleme
          const newWaiting = [...prev]
          initialWaiting.forEach((passenger) => {
            if (!newWaiting.some((p) => p.id === passenger.id)) {
              newWaiting.push(passenger)
            }
          })
          return newWaiting
        })

        // Başlangıçta her durak için bir history kaydı oluştur
        const initialHistory: PassengerHistoryEntry[] = []
        stops.forEach((stop) => {
          // Garaj durağı için history oluşturma
          if (stop.order > 0) {
            const stationWaiting = initialWaiting.filter((p) => p.boardingStop === stop.id).length
            if (stationWaiting > 0) {
              initialHistory.push({
                time: startTime,
                stopId: stop.id,
                waiting: stationWaiting,
                boarded: 0,
                alighted: 0,
              })

              // Simülasyon logu ekle
              addSimulationLog(`${stop.name} durağında başlangıçta ${stationWaiting} yolcu bekliyor`)
            }
          }
        })

        if (initialHistory.length > 0) {
          setPassengerHistory((prev) => [...prev, ...initialHistory])
        }
      }
    }

    setIsRunning(true)
    setIsPaused(false)
    setIsCompleted(false)

    // Simülasyon başlangıç logu ekle
    if (currentTime === startTime) {
      addSimulationLog("Simülasyon başlatıldı")

      // Başlangıçta bekleyen yolcular için log ekle
      stops.forEach((stop) => {
        if (stop.order > 0) {
          const stationWaiting = waitingPassengers.filter((p) => p.boardingStop === stop.id).length
          if (stationWaiting > 0) {
            addSimulationLog(`${stop.name} durağında başlangıçta ${stationWaiting} yolcu bekliyor`)
          }
        }
      })
    } else {
      addSimulationLog("Simülasyon devam ediyor")
    }

    // Simülasyon başlangıç ve bitiş zamanlarını güncelle
    if (currentTime === startTime) {
      startTimeRef.current = startTime
      // Burada simulationParams.duration değerini kullan
      const endTime = dayjs(`2023-01-01 ${startTime}`).add(simulationParams.duration, "minute").format("HH:mm:ss")
      endTimeRef.current = endTime
      console.log(`Simülasyon başlıyor: ${startTime} - ${endTime}, Süre: ${simulationParams.duration} dakika`)
    }

    // Handle maximum speed mode (Stage 4)
    const params = simulationParams
    if (params.speed >= 9999) {
      // Maximum speed mode - jump between discrete events
      timerRef.current = setInterval(() => {
        setCurrentTime((prevTime) => {
          // Find next discrete event time
          const currentDayjs = dayjs(`2023-01-01 ${prevTime}`)
          const endDayjs = dayjs(`2023-01-01 ${endTimeRef.current}`)

          // Check if simulation should end
          if (currentDayjs.isSame(endDayjs) || currentDayjs.isAfter(endDayjs)) {
            if (params.repeat) {
              setTimeout(() => {
                resetSimulation()
                setTimeout(() => {
                  startSimulation()
                }, 100)
              }, 0)
            } else {
              pauseSimulation()
              setIsCompleted(true)
              addSimulationLog("Simülasyon tamamlandı")
            }
            return endTimeRef.current
          }

          // Find next event time from the events queue
          const upcomingEvents = eventsQueueRef.current.filter(
            (event) => dayjs(`2023-01-01 ${event.time}`).isAfter(currentDayjs) && !event.processed,
          )

          // Also check for passenger arrival times
          const upcomingPassengers = passengers.filter(
            (p) => !p.status && dayjs(`2023-01-01 ${p.arrivalTime}`).isAfter(currentDayjs),
          )

          let nextEventTime = null

          // Find the earliest upcoming event
          if (upcomingEvents.length > 0) {
            const earliestBusEvent = upcomingEvents.reduce((earliest, event) =>
              dayjs(`2023-01-01 ${event.time}`).isBefore(dayjs(`2023-01-01 ${earliest.time}`)) ? event : earliest,
            )
            nextEventTime = earliestBusEvent.time
          }

          // Check if any passenger arrival is earlier
          if (upcomingPassengers.length > 0) {
            const earliestPassenger = upcomingPassengers.reduce((earliest, passenger) =>
              dayjs(`2023-01-01 ${passenger.arrivalTime}`).isBefore(dayjs(`2023-01-01 ${earliest.arrivalTime}`))
                ? passenger
                : earliest,
            )

            if (
              !nextEventTime ||
              dayjs(`2023-01-01 ${earliestPassenger.arrivalTime}`).isBefore(dayjs(`2023-01-01 ${nextEventTime}`))
            ) {
              nextEventTime = earliestPassenger.arrivalTime
            }
          }

          // If no events found, jump to end
          if (!nextEventTime) {
            return endTimeRef.current
          }

          // Jump to next event time, but ensure we don't go past the end
          const nextEventDayjs = dayjs(`2023-01-01 ${nextEventTime}`)
          if (nextEventDayjs.isAfter(endDayjs)) {
            return endTimeRef.current
          }

          // Generate logs for all seconds between current time and next event time
          const currentTimeDayjs = dayjs(`2023-01-01 ${prevTime}`)
          let logTime = currentTimeDayjs.add(1, "second")

          while (logTime.isBefore(nextEventDayjs) || logTime.isSame(nextEventDayjs)) {
            const logTimeStr = logTime.format("HH:mm:ss")

            // Process intermediate states for logging
            setTimeout(() => {
              // This will be processed in the next tick to maintain proper state
              processCurrentTime()
            }, 0)

            logTime = logTime.add(1, "second")
          }

          return nextEventTime
        })
      }, 50) // Very fast interval for maximum speed mode
    } else {
      // Normal speed mode
      timerRef.current = setInterval(
        () => {
          setCurrentTime((prevTime) => {
            const nextTime = dayjs(`2023-01-01 ${prevTime}`).add(1, "second").format("HH:mm:ss")

            if (dayjs(`2023-01-01 ${nextTime}`).isAfter(dayjs(`2023-01-01 ${endTimeRef.current}`))) {
              if (params.repeat) {
                setTimeout(() => {
                  resetSimulation()
                  setTimeout(() => {
                    startSimulation()
                  }, 100)
                }, 0)
              } else {
                pauseSimulation()
                setIsCompleted(true)
                addSimulationLog("Simülasyon tamamlandı")
              }
              return endTimeRef.current
            }

            return nextTime
          })
        },
        Math.max(10, 1000 / params.speed),
      )
    }
  }

  // setSimulationParams fonksiyonunu güncelle
  const updateSimulationParams = (params: SimulationParams, skipReset = false) => {
    console.log("Simülasyon parametreleri güncelleniyor:", params, "skipReset:", skipReset)

    const wasRunning = isRunning

    // Eğer simülasyon çalışıyorsa ve sadece hız değişiyorsa
    if (
      wasRunning &&
      params.speed !== simulationParams.speed &&
      params.startTime === simulationParams.startTime &&
      params.duration === simulationParams.duration &&
      params.repeat === simulationParams.repeat
    ) {
      // Sadece hızı güncelle, simülasyonu yeniden başlatma
      setSimulationParams((prevParams) => ({ ...prevParams, speed: params.speed }))

      // Timer'ı yeniden başlat
      if (timerRef.current) {
        clearInterval(timerRef.current)

        timerRef.current = setInterval(
          () => {
            setCurrentTime((prevTime) => {
              const nextTime = dayjs(`2023-01-01 ${prevTime}`).add(1, "second").format("HH:mm:ss")

              if (dayjs(`2023-01-01 ${nextTime}`).isAfter(dayjs(`2023-01-01 ${endTimeRef.current}`))) {
                if (params.repeat) {
                  setTimeout(() => {
                    resetSimulation()
                    setTimeout(() => {
                      startSimulation()
                    }, 100)
                  }, 0)
                } else {
                  pauseSimulation()
                  setIsCompleted(true)
                  addSimulationLog("Simülasyon tamamlandı")
                }
                return endTimeRef.current
              }

              return nextTime
            })
          },
          Math.max(10, 1000 / params.speed), // Minimum 10ms interval for very high speeds
        )
      }
    } else if (skipReset) {
      // Duraklatılmış simülasyonu devam ettirirken sadece parametreleri güncelle
      setSimulationParams(params)
      
      // Simülasyon süresini değiştirdiğimizde bitiş zamanını güncelle
      const startTime = params.startTime + ":00"
      startTimeRef.current = startTime

      const endTime = dayjs(`2023-01-01 ${startTime}`).add(params.duration, "minute").format("HH:mm:ss")
      endTimeRef.current = endTime

      console.log(`Simülasyon parametreleri güncellendi (reset olmadan): ${startTime} - ${endTime}, Süre: ${params.duration} dakika`)
    } else {
      // Diğer parametreler değişiyorsa, simülasyonu durdur ve parametreleri güncelle
      if (wasRunning) {
        pauseSimulation()
      }

      setSimulationParams(params)

      // Simülasyon süresini değiştirdiğimizde bitiş zamanını güncelle
      const startTime = params.startTime + ":00"
      startTimeRef.current = startTime

      const endTime = dayjs(`2023-01-01 ${startTime}`).add(params.duration, "minute").format("HH:mm:ss")
      endTimeRef.current = endTime

      console.log(`Simülasyon parametreleri güncellendi: ${startTime} - ${endTime}, Süre: ${params.duration} dakika`)

      // Simülasyonu sıfırla
      resetSimulation()

      // Simülasyon çalışıyorduysa yeniden başlat
      if (wasRunning) {
        setTimeout(startSimulation, 100)
      }
    }
  }

  // loadStopData fonksiyonunu güncelle - veri yükleme sonrası simülasyonu sıfırla
  const loadStopData = (data: Stop[]) => {
    if (isRunning) {
      pauseSimulation()
    }

    // Garaj durağını ekle (eğer yoksa)
    let updatedData = [...data]
    const hasGarage = updatedData.some((stop) => stop.order === 0 || stop.name.toLowerCase().includes("garaj"))

    if (!hasGarage) {
      // Garaj durağını ekle
      const minOrder = Math.min(...updatedData.map((s) => s.order))
      const route_id = updatedData[0]?.route_id || "171"

      updatedData = [{ id: 0, name: "Garaj", order: 0, timeToNext: 1, route_id }, ...updatedData]
    }

    console.log("Yüklenen durak verileri (garaj eklendi):", updatedData)
    setStops(updatedData)

    // Simülasyonu sıfırla ama yüklenen verileri koru
    resetSimulation()
  }

  // loadPassengerData fonksiyonunu güncelle - veri yükleme sonrası simülasyonu sıfırla
  const loadPassengerData = (data: Passenger[]) => {
    if (isRunning) {
      pauseSimulation()
    }

    console.log("Yüklenen yolcu verileri:", data)
    // Yolcu verilerini state'e kaydet
    setPassengers(data)
    // Ayrıca referans olarak da sakla
    originalPassengersRef.current = data

    // Simülasyonu sıfırla ama yüklenen verileri koru
    resetSimulation()
  }

  // loadBusData fonksiyonunu ekle - otobüs verilerini yükle
  const loadBusData = (data: Bus[]) => {
    if (isRunning) {
      pauseSimulation()
    }

    // Otobüslerin başlangıç durağını garaj olarak ayarla
    const updatedData = data.map((bus) => {
      // Garaj durağını bul
      const garage = stops.find((stop) => stop.order === 0 || stop.name.toLowerCase().includes("garaj"))

      if (garage) {
        return {
          ...bus,
          start_location_stop_id: garage.id,
          current_stop_id: garage.id,
          next_stop_id: getNextStopId(garage.id, bus),
          status: "waiting",
          passengers: [],
          maxOccupancy: 0, // Maksimum doluluk oranını başlat
        }
      }

      return {
        ...bus,
        current_stop_id: bus.start_location_stop_id,
        next_stop_id: getNextStopId(bus.start_location_stop_id, bus),
        status: "waiting",
        passengers: [],
        maxOccupancy: 0, // Maksimum doluluk oranını başlat
      }
    })

    console.log("Yüklenen otobüs verileri (garaj başlangıçlı):", updatedData)

    // Otobüs verilerini state'e kaydet
    setBuses(updatedData)
    // Ayrıca referans olarak da sakla
    originalBusesRef.current = updatedData

    // Simülasyonu sıfırla ama yüklenen verileri koru
    resetSimulation()
  }

  // resetToDefaultData fonksiyonunu güncelle - varsayılan verilere döndükten sonra simülasyonu sıfırla
  const resetToDefaultData = () => {
    if (isRunning) {
      pauseSimulation()
    }

    console.log("Varsayılan verilere dönülüyor")
    setStops(defaultStopData)
    setPassengers(defaultPassengerData)
    setBuses(defaultBusData)
    // Varsayılan verileri referans olarak da sakla
    originalPassengersRef.current = defaultPassengerData
    originalBusesRef.current = defaultBusData

    // Simülasyonu sıfırla
    resetSimulation()
  }

  // addExtraBus fonksiyonunu güncelle - ek seferleri destination_location_stop_id ile oluştur
  const addExtraBus = (extraBusData: ExtraBusData) => {
    // Simülasyon çalışıyorsa durdur
    if (isRunning) {
      pauseSimulation()
    }

    // Yeni otobüs ID'si oluştur (mevcut en yüksek ID + 1)
    const newBusId = Math.max(...buses.map((b) => b.id), 0) + 1

    // Garaj durağını bul
    const garage = stops.find((stop) => stop.order === 0 || stop.name.toLowerCase().includes("garaj"))

    // Başlangıç ve bitiş duraklarını kontrol et
    const startStop = stops.find((s) => s.id === extraBusData.startStopId)
    const destinationStop = stops.find((s) => s.id === extraBusData.destinationStopId)

    if (!startStop || !destinationStop) {
      console.error("Başlangıç veya bitiş durağı bulunamadı")
      return
    }

    // Rota ID'sini mevcut durakların rota ID'sinden al
    const route_id = startStop.route_id

    // Ek seferleri oluştur
    const newBuses: Bus[] = []

    // Başlangıç zamanını dayjs ile parse et
    const startTimeDayjs = dayjs(`2023-01-01 ${extraBusData.startTime}:00`)

    // Simülasyon bitiş zamanını al
    const endTimeDayjs = dayjs(`2023-01-01 ${endTimeRef.current}`)

    // Frekansa göre seferleri oluştur
    let currentTime = startTimeDayjs
    let busCount = 0

    while (currentTime.isBefore(endTimeDayjs) && busCount < 10) {
      // Maksimum 10 ek sefer oluştur
      const busStartTime = currentTime.format("HH:mm")

      const newBus: Bus = {
        id: newBusId + busCount,
        capacity: extraBusData.capacity,
        start_time: busStartTime,
        start_location_stop_id: garage ? garage.id : extraBusData.startStopId, // Garaj varsa garajdan başlat
        destination_location_stop_id: extraBusData.destinationStopId, // Bitiş durağını ekle
        route_id,
        status: "waiting",
        passengers: [],
        isExtra: true, // Ek sefer olduğunu belirt
        maxOccupancy: 0,
      }

      newBuses.push(newBus)

      // Bir sonraki sefer zamanını hesapla
      currentTime = currentTime.add(extraBusData.frequency, "minute")
      busCount++
    }

    // Yeni otobüsleri ekle
    setBuses((prevBuses) => [...prevBuses, ...newBuses])

    // ÖNEMLİ: originalBusesRef'i de güncelle ki resetleme sırasında ek seferler korunsun
    originalBusesRef.current = [...originalBusesRef.current, ...newBuses]

    // Ek seferler için log ekle
    addSimulationLog(
      `${busCount} adet ek sefer oluşturuldu (${extraBusData.startTime}, ${extraBusData.frequency} dk sıklık)`,
    )

    // Olayları yeniden başlat
    eventsQueueRef.current = []
    initializeEvents()

    // Simülasyonu sıfırla
    resetSimulation()
  }

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  // Adım adım ilerleme fonksiyonu
  const stepSimulation = () => {
    // Simülasyon çalışıyorsa durdur
    if (isRunning) {
      pauseSimulation()
    }

    // Bir adım ilerlet (her zaman 1 saniye)
    setCurrentTime((prevTime) => {
      const nextTime = dayjs(`2023-01-01 ${prevTime}`).add(1, "second").format("HH:mm:ss")

      // Bitiş zamanını kontrol et
      if (dayjs(`2023-01-01 ${nextTime}`).isAfter(dayjs(`2023-01-01 ${endTimeRef.current}`))) {
        setIsCompleted(true)
        addSimulationLog("Simülasyon tamamlandı")
        return endTimeRef.current
      }

      return nextTime
    })

    // Bir sonraki adımda işlenecek verileri hemen işle
    setTimeout(() => {
      processCurrentTime()
    }, 0)
  }

  // value objesine addExtraBus fonksiyonunu ekle
  const value = {
    isRunning,
    isPaused,
    currentTime,
    stops,
    passengers,
    waitingPassengers,
    buses,
    passengerHistory,
    simulationParams,
    isCompleted,
    simulationLogs,
    startSimulation,
    pauseSimulation,
    resetSimulation,
    stepSimulation,
    setSimulationParams: updateSimulationParams,
    loadStopData,
    loadPassengerData,
    loadBusData,
    resetToDefaultData,
    addExtraBus, // Yeni fonksiyonu ekle
  }

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>
}

// useSimulation hook'unu dışa aktar
export const useSimulation = () => {
  const context = useContext(SimulationContext)
  if (context === undefined) {
    throw new Error("useSimulation must be used within a SimulationProvider")
  }
  return context
}
