using System.Reflection.Emit;
using System.Security.Cryptography.X509Certificates;
using System.Xml.Serialization;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace BusTrackerRoutes.Models
{
    [Serializable, XmlRoot("NOCLinesRecord")]
    public class Operator
    {
        [XmlElement("NOCCODE")]
        public string? nocCode { get; set; }

        [XmlElement("PubNm")]
        public string? pubNm { get; set; }

        [XmlElement("Mode")]
        public string? mode { get; set; }

        public Route[]? routes { get; set; }

    public Operator()
        {
        }

        public Operator(string _nocCode, string _pubNm, string _mode)
        {
            nocCode = _nocCode;
            pubNm = _pubNm;
            mode = _mode;
        }
    }

    public class Route
    {
        public string? lineRef { get; set; }

        public string? route { get; set; }
        public Route()
        {
        }

        public Route(string _lineRef, string _route)
        {
            lineRef = _lineRef;
            route = _route;
        }
    }
}
