namespace BusTrackerServices.Models
{
    public class VehicleActivity
    {
        public string? RecordedAtTime { get; set; }
        public string? ItemIdentifier { get; set; }
        public string? ValidUntilTime { get; set; }
        public MonitoredVehicleJourney? MonitoredVehicleJourney { get; set; }
    }

    public class MonitoredVehicleJourney
    {
        public string OperatorRef { get; set; }
        public string LineRef { get; set; }
        public string VehicleRef { get; set; }
        public string? VehicleJourneyRef { get; set; }
        public string? DirectionRef { get; set; }
        public string? PublishedLineName { get; set; }
        public string? OriginRef { get; set; }
        public string? OriginName { get; set; }
        public string? DestinationRef { get; set; }
        public string? DestinationName { get; set; }
        public DateTime? OriginAimedDepartureTime { get; set; }
        public VehicleLocation? VehicleLocation { get; set; }

    }

    public class VehicleLocation
    {
        public float? Latitude { get; set; }
        public float? Longitude { get; set; }
    }
}
