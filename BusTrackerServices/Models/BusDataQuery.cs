using System.Security.Cryptography.X509Certificates;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace BusTrackerServices.Models
{
    public class BusDataQuery
    {
        public string? operatorRef { get; set; }
        public string? lineRef { get; set; }
        public string? boundingBox { get; set; }
    }

}
