
// NOTE: Generated code may require at least .NET Framework 4.5 or .NET Core/Standard 2.0.
/// <remarks/>
[System.SerializableAttribute()]
[System.ComponentModel.DesignerCategoryAttribute("code")]
[System.Xml.Serialization.XmlTypeAttribute(AnonymousType = true, Namespace = "http://www.siri.org.uk/siri")]
[System.Xml.Serialization.XmlRootAttribute(Namespace = "http://www.siri.org.uk/siri", IsNullable = false)]
public partial class Siri
{

    private SiriServiceDelivery serviceDeliveryField;

    private decimal versionField;

    /// <remarks/>
    public SiriServiceDelivery ServiceDelivery
    {
        get
        {
            return this.serviceDeliveryField;
        }
        set
        {
            this.serviceDeliveryField = value;
        }
    }

    /// <remarks/>
    [System.Xml.Serialization.XmlAttributeAttribute()]
    public decimal version
    {
        get
        {
            return this.versionField;
        }
        set
        {
            this.versionField = value;
        }
    }
}

/// <remarks/>
[System.SerializableAttribute()]
[System.ComponentModel.DesignerCategoryAttribute("code")]
[System.Xml.Serialization.XmlTypeAttribute(AnonymousType = true, Namespace = "http://www.siri.org.uk/siri")]
public partial class SiriServiceDelivery
{

    private System.DateTime responseTimestampField;

    private string producerRefField;

    private SiriServiceDeliveryVehicleMonitoringDelivery vehicleMonitoringDeliveryField;

    /// <remarks/>
    public System.DateTime ResponseTimestamp
    {
        get
        {
            return this.responseTimestampField;
        }
        set
        {
            this.responseTimestampField = value;
        }
    }

    /// <remarks/>
    public string ProducerRef
    {
        get
        {
            return this.producerRefField;
        }
        set
        {
            this.producerRefField = value;
        }
    }

    /// <remarks/>
    public SiriServiceDeliveryVehicleMonitoringDelivery VehicleMonitoringDelivery
    {
        get
        {
            return this.vehicleMonitoringDeliveryField;
        }
        set
        {
            this.vehicleMonitoringDeliveryField = value;
        }
    }
}

/// <remarks/>
[System.SerializableAttribute()]
[System.ComponentModel.DesignerCategoryAttribute("code")]
[System.Xml.Serialization.XmlTypeAttribute(AnonymousType = true, Namespace = "http://www.siri.org.uk/siri")]
public partial class SiriServiceDeliveryVehicleMonitoringDelivery
{

    private System.DateTime responseTimestampField;

    private string requestMessageRefField;

    private System.DateTime validUntilField;

    private string shortestPossibleCycleField;

    private SiriServiceDeliveryVehicleMonitoringDeliveryVehicleActivity[] vehicleActivityField;

    /// <remarks/>
    public System.DateTime ResponseTimestamp
    {
        get
        {
            return this.responseTimestampField;
        }
        set
        {
            this.responseTimestampField = value;
        }
    }

    /// <remarks/>
    public string RequestMessageRef
    {
        get
        {
            return this.requestMessageRefField;
        }
        set
        {
            this.requestMessageRefField = value;
        }
    }

    /// <remarks/>
    public System.DateTime ValidUntil
    {
        get
        {
            return this.validUntilField;
        }
        set
        {
            this.validUntilField = value;
        }
    }

    /// <remarks/>
    [System.Xml.Serialization.XmlElementAttribute(DataType = "duration")]
    public string ShortestPossibleCycle
    {
        get
        {
            return this.shortestPossibleCycleField;
        }
        set
        {
            this.shortestPossibleCycleField = value;
        }
    }

    /// <remarks/>
    [System.Xml.Serialization.XmlElementAttribute("VehicleActivity")]
    public SiriServiceDeliveryVehicleMonitoringDeliveryVehicleActivity[] VehicleActivity
    {
        get
        {
            return this.vehicleActivityField;
        }
        set
        {
            this.vehicleActivityField = value;
        }
    }
}

/// <remarks/>
[System.SerializableAttribute()]
[System.ComponentModel.DesignerCategoryAttribute("code")]
[System.Xml.Serialization.XmlTypeAttribute(AnonymousType = true, Namespace = "http://www.siri.org.uk/siri")]
public partial class SiriServiceDeliveryVehicleMonitoringDeliveryVehicleActivity
{

    private System.DateTime recordedAtTimeField;

    private string itemIdentifierField;

    private System.DateTime validUntilTimeField;

    private SiriServiceDeliveryVehicleMonitoringDeliveryVehicleActivityMonitoredVehicleJourney monitoredVehicleJourneyField;

    /// <remarks/>
    public System.DateTime RecordedAtTime
    {
        get
        {
            return this.recordedAtTimeField;
        }
        set
        {
            this.recordedAtTimeField = value;
        }
    }

    /// <remarks/>
    public string ItemIdentifier
    {
        get
        {
            return this.itemIdentifierField;
        }
        set
        {
            this.itemIdentifierField = value;
        }
    }

    /// <remarks/>
    public System.DateTime ValidUntilTime
    {
        get
        {
            return this.validUntilTimeField;
        }
        set
        {
            this.validUntilTimeField = value;
        }
    }

    /// <remarks/>
    public SiriServiceDeliveryVehicleMonitoringDeliveryVehicleActivityMonitoredVehicleJourney MonitoredVehicleJourney
    {
        get
        {
            return this.monitoredVehicleJourneyField;
        }
        set
        {
            this.monitoredVehicleJourneyField = value;
        }
    }
}

/// <remarks/>
[System.SerializableAttribute()]
[System.ComponentModel.DesignerCategoryAttribute("code")]
[System.Xml.Serialization.XmlTypeAttribute(AnonymousType = true, Namespace = "http://www.siri.org.uk/siri")]
public partial class SiriServiceDeliveryVehicleMonitoringDeliveryVehicleActivityMonitoredVehicleJourney
{

    private ushort lineRefField;

    private byte directionRefField;

    private string publishedLineNameField;

    private string operatorRefField;

    private string originRefField;

    private string originNameField;

    private string destinationRefField;

    private string destinationNameField;

    private System.DateTime originAimedDepartureTimeField;

    private bool originAimedDepartureTimeFieldSpecified;

    private bool monitoredField;

    private SiriServiceDeliveryVehicleMonitoringDeliveryVehicleActivityMonitoredVehicleJourneyVehicleLocation vehicleLocationField;

    private ushort bearingField;

    private uint vehicleJourneyRefField;

    private bool vehicleJourneyRefFieldSpecified;

    private string vehicleRefField;

    /// <remarks/>
    public ushort LineRef
    {
        get
        {
            return this.lineRefField;
        }
        set
        {
            this.lineRefField = value;
        }
    }

    /// <remarks/>
    public byte DirectionRef
    {
        get
        {
            return this.directionRefField;
        }
        set
        {
            this.directionRefField = value;
        }
    }

    /// <remarks/>
    public string PublishedLineName
    {
        get
        {
            return this.publishedLineNameField;
        }
        set
        {
            this.publishedLineNameField = value;
        }
    }

    /// <remarks/>
    public string OperatorRef
    {
        get
        {
            return this.operatorRefField;
        }
        set
        {
            this.operatorRefField = value;
        }
    }

    /// <remarks/>
    public string OriginRef
    {
        get
        {
            return this.originRefField;
        }
        set
        {
            this.originRefField = value;
        }
    }

    /// <remarks/>
    public string OriginName
    {
        get
        {
            return this.originNameField;
        }
        set
        {
            this.originNameField = value;
        }
    }

    /// <remarks/>
    public string DestinationRef
    {
        get
        {
            return this.destinationRefField;
        }
        set
        {
            this.destinationRefField = value;
        }
    }

    /// <remarks/>
    public string DestinationName
    {
        get
        {
            return this.destinationNameField;
        }
        set
        {
            this.destinationNameField = value;
        }
    }

    /// <remarks/>
    public System.DateTime OriginAimedDepartureTime
    {
        get
        {
            return this.originAimedDepartureTimeField;
        }
        set
        {
            this.originAimedDepartureTimeField = value;
        }
    }

    /// <remarks/>
    [System.Xml.Serialization.XmlIgnoreAttribute()]
    public bool OriginAimedDepartureTimeSpecified
    {
        get
        {
            return this.originAimedDepartureTimeFieldSpecified;
        }
        set
        {
            this.originAimedDepartureTimeFieldSpecified = value;
        }
    }

    /// <remarks/>
    public bool Monitored
    {
        get
        {
            return this.monitoredField;
        }
        set
        {
            this.monitoredField = value;
        }
    }

    /// <remarks/>
    public SiriServiceDeliveryVehicleMonitoringDeliveryVehicleActivityMonitoredVehicleJourneyVehicleLocation VehicleLocation
    {
        get
        {
            return this.vehicleLocationField;
        }
        set
        {
            this.vehicleLocationField = value;
        }
    }

    /// <remarks/>
    public ushort Bearing
    {
        get
        {
            return this.bearingField;
        }
        set
        {
            this.bearingField = value;
        }
    }

    /// <remarks/>
    public uint VehicleJourneyRef
    {
        get
        {
            return this.vehicleJourneyRefField;
        }
        set
        {
            this.vehicleJourneyRefField = value;
        }
    }

    /// <remarks/>
    [System.Xml.Serialization.XmlIgnoreAttribute()]
    public bool VehicleJourneyRefSpecified
    {
        get
        {
            return this.vehicleJourneyRefFieldSpecified;
        }
        set
        {
            this.vehicleJourneyRefFieldSpecified = value;
        }
    }

    /// <remarks/>
    public string VehicleRef
    {
        get
        {
            return this.vehicleRefField;
        }
        set
        {
            this.vehicleRefField = value;
        }
    }
}

/// <remarks/>
[System.SerializableAttribute()]
[System.ComponentModel.DesignerCategoryAttribute("code")]
[System.Xml.Serialization.XmlTypeAttribute(AnonymousType = true, Namespace = "http://www.siri.org.uk/siri")]
public partial class SiriServiceDeliveryVehicleMonitoringDeliveryVehicleActivityMonitoredVehicleJourneyVehicleLocation
{

    private decimal longitudeField;

    private decimal latitudeField;

    /// <remarks/>
    public decimal Longitude
    {
        get
        {
            return this.longitudeField;
        }
        set
        {
            this.longitudeField = value;
        }
    }

    /// <remarks/>
    public decimal Latitude
    {
        get
        {
            return this.latitudeField;
        }
        set
        {
            this.latitudeField = value;
        }
    }
}

