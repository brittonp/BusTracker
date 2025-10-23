using System.Security.Cryptography.X509Certificates;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace BusTrackerAPI.Models
{
    public class BusDataQuery
    {
        public string? operatorRef { get; set; }
        public string? lineRef { get; set; }
        public string? boundingBox { get; set; }
    }

    public class SystemParameter
    {
        public string? name { get; set; }
        public string? value { get; set; }
        public string? created { get; set; }
        public string? created_by { get; set; }
        public string? updated { get; set; }
        public string? updated_by { get; set; }
        public int? version { get; set; }
    }

    public class Error
    {
        public string? errorCode { get; set; }
        public string? message { get; set; }

        public Error(string _errorCode, string _message)
        {
            errorCode = _errorCode;
            message = _message;
        }
    }

    public class Line
    {
        public required string LineRef { get; set; }
        public required string LineName { get; set; }
        public required DateTime Added { get; set; }

    }
    public class Operator
    {
        public required string OperatorRef { get; set; }
        public required string OperatorName { get; set; }

        public List<Line> Lines { get; set;} = new List<Line>();
    }


}
