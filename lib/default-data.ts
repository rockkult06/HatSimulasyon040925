import type { Stop, Passenger, Bus } from "@/context/simulation-context"

// Default stop data - Garaj durağını ekleyelim
export const defaultStopData: Stop[] = [
  { id: 0, name: "Garaj", order: 0, timeToNext: 60, route_id: "171" }, // 1 dakika = 60 saniye
  { id: 1, name: "A Durak", order: 1, timeToNext: 240, route_id: "171" }, // 4 dakika = 240 saniye
  { id: 2, name: "B Durak", order: 2, timeToNext: 180, route_id: "171" }, // 3 dakika = 180 saniye
  { id: 3, name: "C Durak", order: 3, timeToNext: 300, route_id: "171" }, // 5 dakika = 300 saniye
  { id: 4, name: "D Durak", order: 4, timeToNext: 360, route_id: "171" }, // 6 dakika = 360 saniye
  { id: 5, name: "E Durak", order: 5, timeToNext: null, route_id: "171" },
]

// Default passenger data
export const defaultPassengerData: Passenger[] = [
  { id: 1, arrivalTime: "07:01:00", boardingStop: 1, alightingStop: 2 },
  { id: 2, arrivalTime: "07:01:00", boardingStop: 4, alightingStop: 5 },
  { id: 3, arrivalTime: "07:01:00", boardingStop: 3, alightingStop: 4 },
  { id: 4, arrivalTime: "07:01:00", boardingStop: 1, alightingStop: 3 },
  { id: 5, arrivalTime: "07:02:00", boardingStop: 1, alightingStop: 4 },
  { id: 6, arrivalTime: "07:02:00", boardingStop: 3, alightingStop: 4 },
  { id: 7, arrivalTime: "07:03:00", boardingStop: 3, alightingStop: 5 },
  { id: 8, arrivalTime: "07:03:00", boardingStop: 2, alightingStop: 5 },
  { id: 9, arrivalTime: "07:03:00", boardingStop: 2, alightingStop: 5 },
  { id: 10, arrivalTime: "07:05:00", boardingStop: 2, alightingStop: 5 },
  { id: 11, arrivalTime: "07:06:00", boardingStop: 4, alightingStop: 5 },
  { id: 12, arrivalTime: "07:07:00", boardingStop: 1, alightingStop: 4 },
  { id: 13, arrivalTime: "07:08:00", boardingStop: 4, alightingStop: 5 },
  { id: 14, arrivalTime: "07:08:00", boardingStop: 3, alightingStop: 4 },
  { id: 15, arrivalTime: "07:13:00", boardingStop: 1, alightingStop: 3 },
  { id: 16, arrivalTime: "07:13:00", boardingStop: 3, alightingStop: 5 },
  { id: 17, arrivalTime: "07:14:00", boardingStop: 4, alightingStop: 5 },
  { id: 18, arrivalTime: "07:14:00", boardingStop: 3, alightingStop: 5 },
  { id: 19, arrivalTime: "07:14:00", boardingStop: 3, alightingStop: 4 },
  { id: 20, arrivalTime: "07:14:00", boardingStop: 3, alightingStop: 5 },
]

// Default bus data - Otobüslerin başlangıç durağını garaj olarak değiştirelim
export const defaultBusData: Bus[] = [
  {
    id: 1,
    capacity: 3,
    start_time: "07:00",
    start_location_stop_id: 0, // Garajdan başlasın
    route_id: "171",
    status: "waiting",
    passengers: [],
    maxOccupancy: 0,
  },
  {
    id: 2,
    capacity: 3,
    start_time: "07:15",
    start_location_stop_id: 0, // Garajdan başlasın
    route_id: "171",
    status: "waiting",
    passengers: [],
    maxOccupancy: 0,
  },
  {
    id: 3,
    capacity: 3,
    start_time: "07:30",
    start_location_stop_id: 0, // Garajdan başlasın
    route_id: "171",
    status: "waiting",
    passengers: [],
    maxOccupancy: 0,
  },
  {
    id: 4,
    capacity: 3,
    start_time: "07:45",
    start_location_stop_id: 0, // Garajdan başlasın
    route_id: "171",
    status: "waiting",
    passengers: [],
    maxOccupancy: 0,
  },
  {
    id: 5,
    capacity: 3,
    start_time: "08:00",
    start_location_stop_id: 0, // Garajdan başlasın
    route_id: "171",
    status: "waiting",
    passengers: [],
    maxOccupancy: 0,
  },
  {
    id: 6,
    capacity: 3,
    start_time: "08:15",
    start_location_stop_id: 0, // Garajdan başlasın
    route_id: "171",
    status: "waiting",
    passengers: [],
    maxOccupancy: 0,
  },
  {
    id: 7,
    capacity: 3,
    start_time: "08:30",
    start_location_stop_id: 0, // Garajdan başlasın
    route_id: "171",
    status: "waiting",
    passengers: [],
    maxOccupancy: 0,
  },
  {
    id: 8,
    capacity: 3,
    start_time: "08:45",
    start_location_stop_id: 0, // Garajdan başlasın
    route_id: "171",
    status: "waiting",
    passengers: [],
    maxOccupancy: 0,
  },
  {
    id: 9,
    capacity: 3,
    start_time: "09:00",
    start_location_stop_id: 0, // Garajdan başlasın
    route_id: "171",
    status: "waiting",
    passengers: [],
    maxOccupancy: 0,
  },
]
